/**
 * Consumer Monetization Routes
 * 
 * Revenue streams from consumers (per pitch deck):
 * 1. Transaction (and delivery) fees
 * 2. Data monetization / ad revenue
 * 3. Premium membership and subscription options
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const db = require('../models/database');

// ============================================
// CONSUMER MEMBERSHIP TIERS
// ============================================
const CONSUMER_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    features: {
      deliveryFee: 4.99,        // flat per order
      serviceFee: 0.05,         // 5% of order subtotal
      freeDeliveryMinimum: null, // no free delivery threshold
      prioritySupport: false,
      exclusiveDeals: false,
      cashback: 0,
      maxSavedStores: 5,
      priceDropAlerts: false,
      earlyAccess: false,
    },
    description: 'Search and order from local stores. Standard fees apply.'
  },
  radar_plus: {
    id: 'radar_plus',
    name: 'Radar+',
    price: 7.99,
    interval: 'monthly',
    annualPrice: 59.99,         // ~$5/mo billed annually
    features: {
      deliveryFee: 0,           // free delivery
      serviceFee: 0.02,         // reduced to 2%
      freeDeliveryMinimum: 15,  // free delivery on orders $15+
      prioritySupport: true,
      exclusiveDeals: true,
      cashback: 0.03,           // 3% cashback on pickup orders
      maxSavedStores: 50,
      priceDropAlerts: true,
      earlyAccess: true,
    },
    description: 'Free delivery, lower fees, exclusive deals, and 3% cashback on pickup.'
  },
  radar_pro: {
    id: 'radar_pro',
    name: 'Radar Pro',
    price: 14.99,
    interval: 'monthly',
    annualPrice: 99.99,         // ~$8.33/mo billed annually
    features: {
      deliveryFee: 0,
      serviceFee: 0,            // no service fee
      freeDeliveryMinimum: 0,   // always free delivery
      prioritySupport: true,
      exclusiveDeals: true,
      cashback: 0.05,           // 5% cashback on all orders
      maxSavedStores: -1,       // unlimited
      priceDropAlerts: true,
      earlyAccess: true,
    },
    description: 'Zero fees, free delivery always, 5% cashback, and priority everything.'
  }
};

// ============================================
// 1. CONSUMER PLANS & SUBSCRIPTION
// ============================================

// GET /api/monetization/consumer/plans - List all consumer plans
router.get('/plans', (req, res) => {
  res.json({
    plans: Object.values(CONSUMER_PLANS),
    comparison: {
      headers: ['Feature', 'Free', 'Radar+', 'Radar Pro'],
      rows: [
        ['Monthly Price', 'Free', '$7.99/mo', '$14.99/mo'],
        ['Annual Price', 'Free', '$59.99/yr', '$99.99/yr'],
        ['Delivery Fee', '$4.99', 'Free on $15+', 'Always Free'],
        ['Service Fee', '5%', '2%', 'None'],
        ['Cashback on Pickup', 'None', '3%', '5%'],
        ['Exclusive Deals', '❌', '✅', '✅'],
        ['Price Drop Alerts', '❌', '✅', '✅'],
        ['Priority Support', '❌', '✅', '✅'],
        ['Early Access', '❌', '✅', '✅'],
      ]
    }
  });
});

// POST /api/monetization/consumer/subscribe - Subscribe to consumer plan
router.post('/subscribe', authenticate, (req, res) => {
  const { planId, billingInterval = 'monthly' } = req.body;

  if (!planId || !CONSUMER_PLANS[planId]) {
    return res.status(400).json({ error: `Invalid plan. Options: ${Object.keys(CONSUMER_PLANS).join(', ')}` });
  }

  const plan = CONSUMER_PLANS[planId];

  // Cancel existing
  const existing = db.consumerSubscriptions.find(s => s.userId === req.user.id && s.status === 'active');
  if (existing) {
    existing.status = 'cancelled';
    existing.cancelledAt = new Date().toISOString();
  }

  const price = billingInterval === 'annual' && plan.annualPrice ? plan.annualPrice : plan.price;

  const subscription = {
    id: uuidv4(),
    userId: req.user.id,
    planId: plan.id,
    planName: plan.name,
    billingInterval,
    price,
    features: plan.features,
    status: 'active',
    trialEndsAt: plan.price > 0 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: billingInterval === 'annual'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    cashbackEarned: 0,
    // Payment integration point
    stripeSubscriptionId: null,
    createdAt: new Date().toISOString(),
  };

  db.consumerSubscriptions.push(subscription);

  db.notifications.push({
    id: uuidv4(),
    userId: req.user.id,
    type: 'subscription',
    title: `Welcome to ${plan.name}!`,
    message: plan.price > 0
      ? `Your 7-day free trial has started. You'll be charged $${price}/${billingInterval === 'annual' ? 'year' : 'month'} after the trial.`
      : 'You\'re on the free plan. Upgrade anytime for free delivery and exclusive deals.',
    read: false,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({
    message: 'Subscription created',
    subscription,
    savings: plan.price > 0 ? {
      deliverySavings: 'Up to $4.99 per order',
      serviceFeeReduction: plan.id === 'radar_pro' ? '5% → 0%' : '5% → 2%',
      cashbackRate: `${(plan.features.cashback * 100).toFixed(0)}% on ${plan.id === 'radar_pro' ? 'all orders' : 'pickup orders'}`,
      estimatedMonthlySavings: '$15-30 with 4+ orders/month',
    } : null
  });
});

// GET /api/monetization/consumer/membership - Get current membership
router.get('/membership', authenticate, (req, res) => {
  const sub = db.consumerSubscriptions.find(s => s.userId === req.user.id && s.status === 'active');
  const plan = sub ? CONSUMER_PLANS[sub.planId] : CONSUMER_PLANS.free;

  // Calculate cashback earned
  const userOrders = db.orders.filter(o => o.userId === req.user.id && o.status !== 'cancelled');
  const cashbackOrders = sub?.features.cashback > 0 ? userOrders : [];
  const pickupOrders = cashbackOrders.filter(o => o.fulfillment === 'pickup');
  const allCashback = plan.id === 'radar_pro'
    ? userOrders.reduce((sum, o) => sum + (o.subtotal * plan.features.cashback), 0)
    : pickupOrders.reduce((sum, o) => sum + (o.subtotal * plan.features.cashback), 0);

  res.json({
    plan: {
      id: plan.id,
      name: plan.name,
      price: sub?.price || 0,
      interval: sub?.billingInterval || null,
    },
    features: plan.features,
    stats: {
      orderCount: userOrders.length,
      totalSpent: parseFloat(userOrders.reduce((s, o) => s + o.total, 0).toFixed(2)),
      deliverySaved: parseFloat((userOrders.length * (plan.features.deliveryFee === 0 ? 4.99 : 0)).toFixed(2)),
      cashbackEarned: parseFloat(allCashback.toFixed(2)),
    },
    subscription: sub,
  });
});

// POST /api/monetization/consumer/cancel - Cancel membership
router.post('/cancel', authenticate, (req, res) => {
  const sub = db.consumerSubscriptions.find(s => s.userId === req.user.id && s.status === 'active');
  if (!sub || sub.planId === 'free') {
    return res.status(400).json({ error: 'No paid membership to cancel' });
  }

  sub.status = 'cancelling';
  sub.cancelsAt = sub.currentPeriodEnd;
  res.json({
    message: `Your ${sub.planName} membership will end on ${sub.currentPeriodEnd.split('T')[0]}. You'll keep benefits until then.`,
    subscription: sub
  });
});


// ============================================
// 2. FEE CALCULATOR (used at checkout)
// ============================================

// POST /api/monetization/consumer/calculate-fees - Calculate order fees
router.post('/calculate-fees', optionalAuth, (req, res) => {
  const { subtotal, fulfillment = 'delivery', itemCount = 1 } = req.body;

  if (!subtotal || subtotal <= 0) {
    return res.status(400).json({ error: 'Valid subtotal required' });
  }

  // Get user's plan
  let plan = CONSUMER_PLANS.free;
  if (req.user) {
    const sub = db.consumerSubscriptions.find(s => s.userId === req.user.id && s.status === 'active');
    if (sub) plan = CONSUMER_PLANS[sub.planId] || CONSUMER_PLANS.free;
  }

  // Calculate fees
  const serviceFee = parseFloat((subtotal * plan.features.serviceFee).toFixed(2));

  let deliveryFee = 0;
  if (fulfillment === 'delivery') {
    if (plan.features.deliveryFee === 0) {
      if (plan.features.freeDeliveryMinimum !== null && subtotal < plan.features.freeDeliveryMinimum) {
        deliveryFee = 4.99; // below minimum for Radar+ plan
      } else {
        deliveryFee = 0;
      }
    } else {
      deliveryFee = plan.features.deliveryFee;
    }
  }

  // Tax (NYC rate)
  const taxRate = 0.08875;
  const tax = parseFloat((subtotal * taxRate).toFixed(2));

  // Cashback
  let cashback = 0;
  if (plan.features.cashback > 0) {
    if (plan.id === 'radar_pro') {
      cashback = parseFloat((subtotal * plan.features.cashback).toFixed(2));
    } else if (fulfillment === 'pickup') {
      cashback = parseFloat((subtotal * plan.features.cashback).toFixed(2));
    }
  }

  const total = parseFloat((subtotal + serviceFee + deliveryFee + tax).toFixed(2));

  res.json({
    breakdown: {
      subtotal: parseFloat(subtotal.toFixed(2)),
      serviceFee,
      deliveryFee,
      tax,
      total,
      cashback,
      effectiveTotal: parseFloat((total - cashback).toFixed(2)),
    },
    plan: plan.name,
    savings: plan.id !== 'free' ? {
      deliverySaved: fulfillment === 'delivery' && plan.features.deliveryFee === 0 ? 4.99 : 0,
      serviceFeeSaved: parseFloat((subtotal * (CONSUMER_PLANS.free.features.serviceFee - plan.features.serviceFee)).toFixed(2)),
      cashbackEarned: cashback,
    } : null,
    upgradePrompt: plan.id === 'free' ? {
      message: `Save $${(4.99 + serviceFee).toFixed(2)} on this order with Radar+`,
      plan: 'radar_plus',
      price: '$7.99/mo',
    } : null,
  });
});


// ============================================
// 3. DATA & AD ANALYTICS (aggregate, anonymized)
// ============================================

// GET /api/monetization/consumer/ad-placements - Get ad slots for a page
router.get('/ad-placements', optionalAuth, (req, res) => {
  const { page = 'search', category, query } = req.query;

  // Find active promotions that match this context
  const activePromos = db.promotions.filter(p => p.status === 'active');

  const placements = [];

  // Search results: show sponsored listings at top
  if (page === 'search') {
    const searchPromos = activePromos.filter(p => p.placement.startsWith('search'));
    for (const promo of searchPromos.slice(0, 2)) {
      promo.impressions++;
      placements.push({
        type: 'sponsored_listing',
        promotionId: promo.id,
        storeId: promo.storeId,
        placement: promo.placement,
        label: 'Sponsored',
      });
    }
  }

  // Homepage: show featured stores
  if (page === 'homepage') {
    const homePromos = activePromos.filter(p => p.placement === 'homepage_featured');
    for (const promo of homePromos.slice(0, 3)) {
      promo.impressions++;
      placements.push({
        type: 'featured_store',
        promotionId: promo.id,
        storeId: promo.storeId,
        placement: 'homepage_featured',
        label: 'Featured',
      });
    }
  }

  res.json({
    page,
    placements,
    // Privacy note: no individual user data is shared with advertisers
    privacyNote: 'Ads are served based on search context, not personal data. See our privacy policy.',
  });
});

// POST /api/monetization/consumer/ad-click - Track ad click
router.post('/ad-click', optionalAuth, (req, res) => {
  const { promotionId } = req.body;
  const promo = db.promotions.find(p => p.id === promotionId);
  if (promo) {
    promo.clicks++;
    if (promo.pricing.cpc) {
      promo.totalSpent += promo.pricing.cpc;
    }
  }
  res.json({ tracked: true });
});

module.exports = router;
module.exports.CONSUMER_PLANS = CONSUMER_PLANS;
