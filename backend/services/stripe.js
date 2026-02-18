/**
 * Stripe Service
 * Wraps the Stripe SDK with a mock fallback for development.
 * When STRIPE_SECRET_KEY starts with 'sk_test_mock', all calls
 * return simulated responses so the app works without a real account.
 */

const stripeConfig = require('../config/stripe');
const { v4: uuidv4 } = require('uuid');

const isMock = stripeConfig.secretKey.includes('mock');
let stripe = null;

if (!isMock) {
  const Stripe = require('stripe');
  stripe = new Stripe(stripeConfig.secretKey, { apiVersion: '2024-06-20' });
}

// ========== MOCK STORE (in-memory for dev) ==========
const mockCustomers = {};
const mockSubscriptions = {};
const mockSessions = {};
const mockPaymentMethods = {};

// ========== CUSTOMERS ==========

async function createCustomer({ email, name, metadata = {} }) {
  if (isMock) {
    const id = `cus_mock_${uuidv4().slice(0, 12)}`;
    mockCustomers[id] = { id, email, name, metadata, created: Date.now() };
    return mockCustomers[id];
  }
  return stripe.customers.create({ email, name, metadata });
}

async function getCustomer(customerId) {
  if (isMock) return mockCustomers[customerId] || null;
  return stripe.customers.retrieve(customerId);
}

async function updateCustomer(customerId, data) {
  if (isMock) {
    if (mockCustomers[customerId]) Object.assign(mockCustomers[customerId], data);
    return mockCustomers[customerId];
  }
  return stripe.customers.update(customerId, data);
}

// ========== CHECKOUT SESSIONS ==========

async function createCheckoutSession({
  customerId, priceIds, mode = 'subscription',
  successUrl, cancelUrl, metadata = {},
  trialDays = 0, allowPromoCodes = false,
}) {
  if (isMock) {
    const id = `cs_mock_${uuidv4().slice(0, 12)}`;
    const session = {
      id,
      object: 'checkout.session',
      url: `${stripeConfig.appUrl}/portal?stripe_session=${id}`,
      customer: customerId,
      mode,
      metadata,
      payment_status: 'unpaid',
      status: 'open',
      subscription: mode === 'subscription' ? `sub_mock_${uuidv4().slice(0, 12)}` : null,
      line_items: priceIds.map(p => ({ price: p })),
    };
    mockSessions[id] = session;

    // Auto-complete for mock
    if (mode === 'subscription' && session.subscription) {
      mockSubscriptions[session.subscription] = {
        id: session.subscription,
        customer: customerId,
        status: trialDays > 0 ? 'trialing' : 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        trial_end: trialDays > 0 ? Math.floor(Date.now() / 1000) + trialDays * 86400 : null,
        items: { data: priceIds.map(p => ({ price: { id: p } })) },
        metadata,
        cancel_at_period_end: false,
      };
    }
    return session;
  }

  const params = {
    customer: customerId,
    mode,
    line_items: priceIds.map(priceId => ({ price: priceId, quantity: 1 })),
    success_url: successUrl || `${stripeConfig.appUrl}/portal?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${stripeConfig.appUrl}/portal?payment=cancelled`,
    metadata,
    allow_promotion_codes: allowPromoCodes,
  };
  if (trialDays > 0 && mode === 'subscription') {
    params.subscription_data = { trial_period_days: trialDays };
  }
  return stripe.checkout.sessions.create(params);
}

async function getCheckoutSession(sessionId) {
  if (isMock) return mockSessions[sessionId] || null;
  return stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription', 'line_items'] });
}

// ========== SUBSCRIPTIONS ==========

async function getSubscription(subscriptionId) {
  if (isMock) return mockSubscriptions[subscriptionId] || null;
  return stripe.subscriptions.retrieve(subscriptionId);
}

async function updateSubscription(subscriptionId, data) {
  if (isMock) {
    if (mockSubscriptions[subscriptionId]) Object.assign(mockSubscriptions[subscriptionId], data);
    return mockSubscriptions[subscriptionId];
  }
  return stripe.subscriptions.update(subscriptionId, data);
}

async function cancelSubscription(subscriptionId, { atPeriodEnd = true } = {}) {
  if (isMock) {
    const sub = mockSubscriptions[subscriptionId];
    if (sub) {
      if (atPeriodEnd) {
        sub.cancel_at_period_end = true;
        sub.cancel_at = sub.current_period_end;
      } else {
        sub.status = 'canceled';
      }
    }
    return sub;
  }
  if (atPeriodEnd) {
    return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  }
  return stripe.subscriptions.cancel(subscriptionId);
}

async function resumeSubscription(subscriptionId) {
  if (isMock) {
    const sub = mockSubscriptions[subscriptionId];
    if (sub) { sub.cancel_at_period_end = false; sub.cancel_at = null; }
    return sub;
  }
  return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
}

// Change plan (swap price on existing subscription)
async function changePlan(subscriptionId, newPriceId) {
  if (isMock) {
    const sub = mockSubscriptions[subscriptionId];
    if (sub) {
      sub.items = { data: [{ price: { id: newPriceId } }] };
      sub.metadata = { ...sub.metadata, planChanged: new Date().toISOString() };
    }
    return sub;
  }
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return stripe.subscriptions.update(subscriptionId, {
    items: [{ id: sub.items.data[0].id, price: newPriceId }],
    proration_behavior: 'always_invoice',
  });
}

// ========== BILLING PORTAL ==========

async function createBillingPortalSession(customerId, returnUrl) {
  if (isMock) {
    return {
      id: `bps_mock_${uuidv4().slice(0, 8)}`,
      url: `${stripeConfig.appUrl}/portal?billing=true`,
      customer: customerId,
    };
  }
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || `${stripeConfig.appUrl}/portal`,
  });
}

// ========== PAYMENT METHODS ==========

async function listPaymentMethods(customerId) {
  if (isMock) {
    return { data: Object.values(mockPaymentMethods).filter(pm => pm.customer === customerId) };
  }
  return stripe.paymentMethods.list({ customer: customerId, type: 'card' });
}

async function attachPaymentMethod(paymentMethodId, customerId) {
  if (isMock) {
    const pm = {
      id: paymentMethodId || `pm_mock_${uuidv4().slice(0, 8)}`,
      customer: customerId,
      type: 'card',
      card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2027 },
    };
    mockPaymentMethods[pm.id] = pm;
    return pm;
  }
  return stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
}

// ========== INVOICES ==========

async function listInvoices(customerId, limit = 10) {
  if (isMock) {
    return {
      data: [{
        id: `in_mock_${uuidv4().slice(0, 8)}`,
        customer: customerId,
        amount_paid: 4900,
        currency: 'usd',
        status: 'paid',
        created: Math.floor(Date.now() / 1000) - 86400,
        invoice_pdf: null,
        lines: { data: [{ description: 'Starter Plan', amount: 4900 }] },
      }],
    };
  }
  return stripe.invoices.list({ customer: customerId, limit });
}

// ========== WEBHOOKS ==========

function constructWebhookEvent(payload, signature) {
  if (isMock) {
    // In mock mode, parse the JSON directly (handle string, Buffer, or object)
    if (Buffer.isBuffer(payload)) payload = payload.toString('utf8');
    const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
    return event;
  }
  return stripe.webhooks.constructEvent(payload, signature, stripeConfig.webhookSecret);
}

// ========== EXPORTS ==========

module.exports = {
  isMock,
  stripe,
  // Customers
  createCustomer,
  getCustomer,
  updateCustomer,
  // Checkout
  createCheckoutSession,
  getCheckoutSession,
  // Subscriptions
  getSubscription,
  updateSubscription,
  cancelSubscription,
  resumeSubscription,
  changePlan,
  // Billing portal
  createBillingPortalSession,
  // Payment methods
  listPaymentMethods,
  attachPaymentMethod,
  // Invoices
  listInvoices,
  // Webhooks
  constructWebhookEvent,
  // Mock internals (for testing)
  _mock: { mockCustomers, mockSubscriptions, mockSessions, mockPaymentMethods },
};
