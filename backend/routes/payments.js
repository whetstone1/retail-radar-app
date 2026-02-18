/**
 * Payment Routes
 * Handles Stripe checkout, webhooks, billing portal, and payment method management.
 * Works in mock mode for development and real Stripe in production.
 */

const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripe');
const stripeConfig = require('../config/stripe');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../models/database');

// ============================================
// CONFIG (public - returns publishable key)
// ============================================
router.get('/config', (req, res) => {
  res.json({
    publishableKey: stripeConfig.publishableKey,
    mode: stripeService.isMock ? 'mock' : 'live',
  });
});

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

// POST /api/payments/create-customer - Create or get Stripe customer for user
router.post('/create-customer', authenticate, async (req, res) => {
  try {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.stripeCustomerId) {
      const customer = await stripeService.getCustomer(user.stripeCustomerId);
      return res.json({ customerId: customer.id, existing: true });
    }

    const customer = await stripeService.createCustomer({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id, role: user.role },
    });

    user.stripeCustomerId = customer.id;
    res.status(201).json({ customerId: customer.id, existing: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create customer', detail: err.message });
  }
});

// ============================================
// B2B CHECKOUT (Store subscriptions)
// ============================================

// POST /api/payments/b2b/checkout - Create checkout session for store plan
router.post('/b2b/checkout', authenticate, authorize('store_owner', 'admin'), async (req, res) => {
  try {
    const { storeId, planId, inventoryPlanId } = req.body;
    if (!storeId || !planId) return res.status(400).json({ error: 'storeId and planId required' });

    // Validate plan
    const priceConfig = stripeConfig.b2bPrices[planId];
    if (!priceConfig) return res.status(400).json({ error: `Invalid plan: ${planId}` });
    if (planId === 'free') return res.json({ message: 'Free plan requires no payment', planId });

    // Ensure user has Stripe customer
    const user = db.users.find(u => u.id === req.user.id);
    if (!user.stripeCustomerId) {
      const customer = await stripeService.createCustomer({
        email: user.email, name: user.name,
        metadata: { userId: user.id, role: 'store_owner' },
      });
      user.stripeCustomerId = customer.id;
    }

    // Build price list
    const priceIds = [priceConfig.monthly];
    if (inventoryPlanId && stripeConfig.b2bInventoryPrices[inventoryPlanId]) {
      priceIds.push(stripeConfig.b2bInventoryPrices[inventoryPlanId].monthly);
    }

    const session = await stripeService.createCheckoutSession({
      customerId: user.stripeCustomerId,
      priceIds,
      mode: 'subscription',
      successUrl: `${stripeConfig.appUrl}/portal?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${stripeConfig.appUrl}/portal?payment=cancelled`,
      metadata: { type: 'b2b', storeId, planId, inventoryPlanId: inventoryPlanId || '', userId: user.id },
      trialDays: 0,
    });

    res.json({
      sessionId: session.id,
      url: session.url,
      subscriptionId: session.subscription,
    });
  } catch (err) {
    res.status(500).json({ error: 'Checkout failed', detail: err.message });
  }
});

// POST /api/payments/b2b/change-plan - Upgrade/downgrade B2B plan
router.post('/b2b/change-plan', authenticate, authorize('store_owner', 'admin'), async (req, res) => {
  try {
    const { storeId, newPlanId } = req.body;
    if (!storeId || !newPlanId) return res.status(400).json({ error: 'storeId and newPlanId required' });

    const sub = db.subscriptions.find(s => s.storeId === storeId && s.status === 'active');
    if (!sub?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active Stripe subscription found. Use checkout to subscribe first.' });
    }

    const newPrice = stripeConfig.b2bPrices[newPlanId]?.monthly;
    if (!newPrice) return res.status(400).json({ error: `Invalid plan: ${newPlanId}` });

    const updated = await stripeService.changePlan(sub.stripeSubscriptionId, newPrice);

    // Update internal record
    sub.planId = newPlanId;
    sub.updatedAt = new Date().toISOString();

    res.json({ message: `Plan changed to ${newPlanId}`, subscription: { stripeId: updated.id, planId: newPlanId } });
  } catch (err) {
    res.status(500).json({ error: 'Plan change failed', detail: err.message });
  }
});

// POST /api/payments/b2b/cancel - Cancel B2B subscription
router.post('/b2b/cancel', authenticate, authorize('store_owner', 'admin'), async (req, res) => {
  try {
    const { storeId, immediate = false } = req.body;
    const sub = db.subscriptions.find(s => s.storeId === storeId && s.status === 'active');
    if (!sub?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active Stripe subscription found' });
    }

    const cancelled = await stripeService.cancelSubscription(sub.stripeSubscriptionId, { atPeriodEnd: !immediate });

    sub.status = immediate ? 'cancelled' : 'cancelling';
    sub.cancelsAt = immediate ? new Date().toISOString() : new Date(cancelled.current_period_end * 1000).toISOString();

    res.json({
      message: immediate ? 'Subscription cancelled immediately' : 'Subscription will cancel at end of billing period',
      cancelsAt: sub.cancelsAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Cancellation failed', detail: err.message });
  }
});

// ============================================
// CONSUMER CHECKOUT
// ============================================

// POST /api/payments/consumer/checkout - Create checkout for consumer plan
router.post('/consumer/checkout', authenticate, async (req, res) => {
  try {
    const { planId, billingInterval = 'monthly' } = req.body;
    if (!planId) return res.status(400).json({ error: 'planId required' });

    const priceConfig = stripeConfig.consumerPrices[planId];
    if (!priceConfig) return res.status(400).json({ error: `Invalid plan: ${planId}` });
    if (planId === 'free') return res.json({ message: 'Free plan requires no payment' });

    const priceId = priceConfig[billingInterval];
    if (!priceId) return res.status(400).json({ error: `No ${billingInterval} price for ${planId}` });

    // Ensure Stripe customer
    const user = db.users.find(u => u.id === req.user.id);
    if (!user.stripeCustomerId) {
      const customer = await stripeService.createCustomer({
        email: user.email, name: user.name,
        metadata: { userId: user.id, role: 'consumer' },
      });
      user.stripeCustomerId = customer.id;
    }

    const session = await stripeService.createCheckoutSession({
      customerId: user.stripeCustomerId,
      priceIds: [priceId],
      mode: 'subscription',
      successUrl: `${stripeConfig.appUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${stripeConfig.appUrl}/?payment=cancelled`,
      metadata: { type: 'consumer', planId, billingInterval, userId: user.id },
      trialDays: stripeConfig.trialDays,
      allowPromoCodes: true,
    });

    res.json({
      sessionId: session.id,
      url: session.url,
      subscriptionId: session.subscription,
    });
  } catch (err) {
    res.status(500).json({ error: 'Checkout failed', detail: err.message });
  }
});

// POST /api/payments/consumer/change-plan
router.post('/consumer/change-plan', authenticate, async (req, res) => {
  try {
    const { newPlanId, billingInterval = 'monthly' } = req.body;
    const sub = db.consumerSubscriptions.find(s => s.userId === req.user.id && s.status === 'active');
    if (!sub?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription. Use checkout to subscribe first.' });
    }

    const newPrice = stripeConfig.consumerPrices[newPlanId]?.[billingInterval];
    if (!newPrice) return res.status(400).json({ error: `Invalid plan/interval: ${newPlanId}/${billingInterval}` });

    const updated = await stripeService.changePlan(sub.stripeSubscriptionId, newPrice);
    sub.planId = newPlanId;
    sub.billingInterval = billingInterval;
    sub.updatedAt = new Date().toISOString();

    res.json({ message: `Plan changed to ${newPlanId} (${billingInterval})`, subscriptionId: updated.id });
  } catch (err) {
    res.status(500).json({ error: 'Plan change failed', detail: err.message });
  }
});

// POST /api/payments/consumer/cancel
router.post('/consumer/cancel', authenticate, async (req, res) => {
  try {
    const { immediate = false } = req.body;
    const sub = db.consumerSubscriptions.find(s => s.userId === req.user.id && s.status === 'active');
    if (!sub?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    await stripeService.cancelSubscription(sub.stripeSubscriptionId, { atPeriodEnd: !immediate });
    sub.status = immediate ? 'cancelled' : 'cancelling';

    res.json({ message: immediate ? 'Cancelled immediately' : 'Cancels at end of billing period' });
  } catch (err) {
    res.status(500).json({ error: 'Cancellation failed', detail: err.message });
  }
});

// ============================================
// BILLING PORTAL
// ============================================

// POST /api/payments/billing-portal - Redirect to Stripe billing portal
router.post('/billing-portal', authenticate, async (req, res) => {
  try {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account. Subscribe to a plan first.' });
    }

    const returnUrl = req.body.returnUrl || `${stripeConfig.appUrl}/portal`;
    const session = await stripeService.createBillingPortalSession(user.stripeCustomerId, returnUrl);

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create billing portal', detail: err.message });
  }
});

// ============================================
// PAYMENT METHODS
// ============================================

// GET /api/payments/payment-methods - List user's payment methods
router.get('/payment-methods', authenticate, async (req, res) => {
  try {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user?.stripeCustomerId) return res.json({ paymentMethods: [] });

    const methods = await stripeService.listPaymentMethods(user.stripeCustomerId);
    res.json({
      paymentMethods: methods.data.map(pm => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list payment methods', detail: err.message });
  }
});

// ============================================
// INVOICES
// ============================================

// GET /api/payments/invoices - List user's invoices
router.get('/invoices', authenticate, async (req, res) => {
  try {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user?.stripeCustomerId) return res.json({ invoices: [] });

    const invoices = await stripeService.listInvoices(user.stripeCustomerId);
    res.json({
      invoices: invoices.data.map(inv => ({
        id: inv.id,
        amount: inv.amount_paid / 100,
        currency: inv.currency,
        status: inv.status,
        date: new Date(inv.created * 1000).toISOString(),
        pdfUrl: inv.invoice_pdf,
        items: inv.lines?.data?.map(l => ({ description: l.description, amount: l.amount / 100 })) || [],
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list invoices', detail: err.message });
  }
});

// ============================================
// CHECKOUT SESSION VERIFICATION
// ============================================

// GET /api/payments/session/:sessionId - Verify checkout result
router.get('/session/:sessionId', authenticate, async (req, res) => {
  try {
    const session = await stripeService.getCheckoutSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({
      sessionId: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      subscriptionId: session.subscription?.id || session.subscription,
      metadata: session.metadata,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify session', detail: err.message });
  }
});

// ============================================
// WEBHOOKS (Stripe → Retail Radar)
// ============================================

// POST /api/payments/webhook - Stripe sends events here
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    const signature = req.headers['stripe-signature'];
    event = stripeService.constructWebhookEvent(req.body, signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }

  const { type, data } = event;
  console.log(`[Stripe Webhook] ${type}`);

  try {
    switch (type) {
      case 'checkout.session.completed': {
        const session = data.object;
        const meta = session.metadata || {};

        if (meta.type === 'b2b') {
          // Activate B2B subscription
          const existing = db.subscriptions.find(s => s.storeId === meta.storeId && s.status === 'active');
          if (existing) existing.status = 'replaced';

          db.subscriptions.push({
            id: require('uuid').v4(),
            storeId: meta.storeId,
            userId: meta.userId,
            planId: meta.planId,
            inventoryPlanId: meta.inventoryPlanId || null,
            stripeSubscriptionId: session.subscription,
            stripeCustomerId: session.customer,
            status: 'active',
            createdAt: new Date().toISOString(),
            currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
          });
        } else if (meta.type === 'consumer') {
          // Activate consumer subscription
          const existing = db.consumerSubscriptions.find(s => s.userId === meta.userId && s.status === 'active');
          if (existing) existing.status = 'replaced';

          db.consumerSubscriptions.push({
            id: require('uuid').v4(),
            userId: meta.userId,
            planId: meta.planId,
            billingInterval: meta.billingInterval || 'monthly',
            stripeSubscriptionId: session.subscription,
            stripeCustomerId: session.customer,
            status: 'active',
            createdAt: new Date().toISOString(),
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = data.object;
        // Update internal records
        const b2bSub = db.subscriptions.find(s => s.stripeSubscriptionId === sub.id);
        if (b2bSub) {
          b2bSub.status = sub.status === 'active' ? 'active' : sub.cancel_at_period_end ? 'cancelling' : sub.status;
          b2bSub.currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }
        const conSub = db.consumerSubscriptions.find(s => s.stripeSubscriptionId === sub.id);
        if (conSub) {
          conSub.status = sub.status === 'active' ? 'active' : sub.cancel_at_period_end ? 'cancelling' : sub.status;
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = data.object;
        const b2bSub = db.subscriptions.find(s => s.stripeSubscriptionId === sub.id);
        if (b2bSub) b2bSub.status = 'cancelled';
        const conSub = db.consumerSubscriptions.find(s => s.stripeSubscriptionId === sub.id);
        if (conSub) conSub.status = 'cancelled';
        break;
      }

      case 'invoice.payment_succeeded': {
        console.log(`[Stripe] Payment succeeded: ${data.object.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = data.object;
        console.log(`[Stripe] Payment failed for customer: ${invoice.customer}`);
        // Mark subscription as past_due
        const b2bSub = db.subscriptions.find(s => s.stripeCustomerId === invoice.customer && s.status === 'active');
        if (b2bSub) b2bSub.status = 'past_due';
        const conSub = db.consumerSubscriptions.find(s => s.stripeCustomerId === invoice.customer && s.status === 'active');
        if (conSub) conSub.status = 'past_due';
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event: ${type}`);
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Error processing ${type}:`, err.message);
  }

  res.json({ received: true });
});

module.exports = router;
