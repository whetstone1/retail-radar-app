/**
 * B2B Monetization Routes
 * 
 * Revenue streams for SMBs (per pitch deck):
 * 1. Commission + Subscription to be on the platform
 * 2. Subscription to inventory optimization software
 * 3. Premium placement on homepage & search results
 * 4. Ads (sponsored listings)
 * 5. Market insights from inventory software
 * 6. Data monetization
 * 7. Delivery commissions
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../models/database');

// ============================================
// SUBSCRIPTION TIERS (Platform Access)
// ============================================
const STORE_PLANS = {
  free: {
    id: 'free',
    name: 'Free Listing',
    price: 0,
    interval: null,
    commission: 0.08,       // 8% per transaction
    features: {
      maxProducts: 25,
      searchListing: true,
      premiumPlacement: false,
      analytics: 'basic',       // views only
      inventoryOptimization: false,
      marketInsights: false,
      adsAllowed: false,
      deliveryCommission: 0.15, // 15% of delivery fee
    },
    description: 'Get listed and start selling. 8% commission on transactions.'
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 49,
    interval: 'monthly',
    commission: 0.05,       // 5% per transaction
    features: {
      maxProducts: 200,
      searchListing: true,
      premiumPlacement: false,
      analytics: 'standard',    // views, clicks, conversions
      inventoryOptimization: false,
      marketInsights: false,
      adsAllowed: true,
      deliveryCommission: 0.12, // 12%
    },
    description: 'For growing stores. Lower commissions, more product listings.'
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 149,
    interval: 'monthly',
    commission: 0.03,       // 3% per transaction
    features: {
      maxProducts: 1000,
      searchListing: true,
      premiumPlacement: true,
      analytics: 'advanced',    // full funnel, cohorts, trends
      inventoryOptimization: true,
      marketInsights: 'basic',  // category-level demand signals
      adsAllowed: true,
      deliveryCommission: 0.08, // 8%
    },
    description: 'Full platform access with inventory optimization and premium placement.'
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499,
    interval: 'monthly',
    commission: 0.015,      // 1.5% per transaction
    features: {
      maxProducts: -1,      // unlimited
      searchListing: true,
      premiumPlacement: true,
      analytics: 'enterprise',  // full data export, API access
      inventoryOptimization: true,
      marketInsights: 'full',   // competitor benchmarking, demand forecasting
      adsAllowed: true,
      deliveryCommission: 0.05, // 5%
    },
    description: 'For chains and high-volume stores. Lowest commissions, full market intelligence.'
  }
};

// ============================================
// INVENTORY OPTIMIZATION SOFTWARE TIERS
// ============================================
const INVENTORY_SOFTWARE_PLANS = {
  basic: {
    id: 'basic',
    name: 'Inventory Basics',
    price: 29,
    interval: 'monthly',
    features: ['Stock level tracking', 'Low stock alerts', 'Basic reports', 'CSV export'],
  },
  pro: {
    id: 'pro',
    name: 'Inventory Pro',
    price: 79,
    interval: 'monthly',
    features: ['Everything in Basic', 'Demand forecasting', 'Reorder suggestions', 'Multi-location sync', 'POS integration ready'],
  },
  ai: {
    id: 'ai',
    name: 'Inventory AI',
    price: 199,
    interval: 'monthly',
    features: ['Everything in Pro', 'AI-powered optimization', 'Seasonal trend analysis', 'Competitor price monitoring', 'Automated reordering', 'Custom analytics dashboard'],
  }
};

// ============================================
// 1. STORE SUBSCRIPTION MANAGEMENT
// ============================================

// GET /api/monetization/b2b/plans - List all store plans
router.get('/plans', (req, res) => {
  res.json({
    platformPlans: Object.values(STORE_PLANS),
    inventorySoftwarePlans: Object.values(INVENTORY_SOFTWARE_PLANS),
  });
});

// POST /api/monetization/b2b/subscribe - Subscribe store to a plan
router.post('/subscribe', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId, planId, inventoryPlanId } = req.body;

  if (!storeId || !planId) {
    return res.status(400).json({ error: 'storeId and planId required' });
  }
  if (!STORE_PLANS[planId]) {
    return res.status(400).json({ error: `Invalid plan. Options: ${Object.keys(STORE_PLANS).join(', ')}` });
  }

  const plan = STORE_PLANS[planId];
  const invPlan = inventoryPlanId ? INVENTORY_SOFTWARE_PLANS[inventoryPlanId] : null;

  // Check if store already has a subscription
  const existing = db.subscriptions.find(s => s.storeId === storeId && s.status === 'active');
  if (existing) {
    existing.status = 'cancelled';
    existing.cancelledAt = new Date().toISOString();
  }

  const subscription = {
    id: uuidv4(),
    storeId,
    userId: req.user.id,
    type: 'platform',
    planId: plan.id,
    planName: plan.name,
    monthlyPrice: plan.price,
    commissionRate: plan.commission,
    features: plan.features,
    inventoryPlan: invPlan ? {
      planId: invPlan.id,
      planName: invPlan.name,
      monthlyPrice: invPlan.price,
      features: invPlan.features,
    } : null,
    totalMonthly: plan.price + (invPlan ? invPlan.price : 0),
    status: 'active',
    trialEndsAt: plan.price > 0 ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    // Payment integration point: Stripe subscription ID would go here
    stripeSubscriptionId: null,
    createdAt: new Date().toISOString(),
  };

  db.subscriptions.push(subscription);

  // Create notification
  db.notifications.push({
    id: uuidv4(),
    userId: req.user.id,
    type: 'subscription',
    title: 'Subscription Active',
    message: `Your store is now on the ${plan.name} plan ($${plan.price}/mo). ${plan.price > 0 ? '14-day free trial started.' : ''}`,
    read: false,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({
    message: 'Subscription created',
    subscription,
    billing: {
      platformFee: `$${plan.price}/mo`,
      inventorySoftware: invPlan ? `$${invPlan.price}/mo` : 'Not subscribed',
      totalMonthly: `$${subscription.totalMonthly}/mo`,
      commissionRate: `${(plan.commission * 100).toFixed(1)}%`,
      deliveryCommission: `${(plan.features.deliveryCommission * 100).toFixed(0)}%`,
      trialEnds: subscription.trialEndsAt,
    }
  });
});

// GET /api/monetization/b2b/subscription/:storeId - Get store subscription status
router.get('/subscription/:storeId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const sub = db.subscriptions.find(s => s.storeId === req.params.storeId && s.status === 'active');

  if (!sub) {
    return res.json({
      subscription: null,
      plan: STORE_PLANS.free,
      message: 'Store is on the free plan. Upgrade for lower commissions and more features.'
    });
  }

  res.json({ subscription: sub });
});

// POST /api/monetization/b2b/cancel - Cancel subscription
router.post('/cancel', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId } = req.body;
  const sub = db.subscriptions.find(s => s.storeId === storeId && s.status === 'active');

  if (!sub) return res.status(404).json({ error: 'No active subscription found' });

  sub.status = 'cancelling';
  sub.cancelsAt = sub.currentPeriodEnd; // Access through end of billing period
  res.json({ message: `Subscription will cancel at end of billing period (${sub.currentPeriodEnd})`, subscription: sub });
});


// ============================================
// 2. PREMIUM PLACEMENT / SPONSORED LISTINGS
// ============================================

// POST /api/monetization/b2b/promote - Create a promoted listing
router.post('/promote', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId, productSkus, placement, dailyBudget, startDate, endDate } = req.body;

  // Check subscription allows ads
  const sub = db.subscriptions.find(s => s.storeId === storeId && s.status === 'active');
  const plan = sub ? STORE_PLANS[sub.planId] : STORE_PLANS.free;
  if (!plan.features.adsAllowed && !plan.features.premiumPlacement) {
    return res.status(403).json({ error: 'Upgrade to Starter or higher to run promoted listings.' });
  }

  const validPlacements = ['search_top', 'search_sidebar', 'homepage_featured', 'category_banner'];
  if (!validPlacements.includes(placement)) {
    return res.status(400).json({ error: `Invalid placement. Options: ${validPlacements.join(', ')}` });
  }

  const PLACEMENT_RATES = {
    search_top: { cpc: 0.35, minDaily: 5 },       // Cost per click
    search_sidebar: { cpc: 0.20, minDaily: 3 },
    homepage_featured: { cpd: 25, minDaily: 25 },  // Cost per day
    category_banner: { cpd: 15, minDaily: 15 },
  };

  const rate = PLACEMENT_RATES[placement];
  if (dailyBudget < rate.minDaily) {
    return res.status(400).json({ error: `Minimum daily budget for ${placement}: $${rate.minDaily}` });
  }

  const promotion = {
    id: uuidv4(),
    storeId,
    userId: req.user.id,
    productSkus: productSkus || [],
    placement,
    pricing: rate,
    dailyBudget: parseFloat(dailyBudget),
    totalSpent: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    status: 'active',
    startDate: startDate || new Date().toISOString(),
    endDate: endDate || null,
    createdAt: new Date().toISOString(),
  };

  db.promotions.push(promotion);

  res.status(201).json({
    message: 'Promoted listing created',
    promotion,
    estimatedReach: placement.includes('search') ? '500-2000 impressions/day' : '1000-5000 impressions/day',
  });
});

// GET /api/monetization/b2b/promotions/:storeId - List store's promotions
router.get('/promotions/:storeId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const promos = db.promotions.filter(p => p.storeId === req.params.storeId);
  const totalSpent = promos.reduce((s, p) => s + p.totalSpent, 0);
  const totalImpressions = promos.reduce((s, p) => s + p.impressions, 0);
  const totalClicks = promos.reduce((s, p) => s + p.clicks, 0);

  res.json({
    promotions: promos,
    summary: {
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      totalImpressions,
      totalClicks,
      avgCTR: totalImpressions > 0 ? `${((totalClicks / totalImpressions) * 100).toFixed(1)}%` : '0%',
    }
  });
});


// ============================================
// 3. MARKET INSIGHTS (Premium Feature)
// ============================================

// GET /api/monetization/b2b/insights/:storeId - Market analytics
router.get('/insights/:storeId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const sub = db.subscriptions.find(s => s.storeId === req.params.storeId && s.status === 'active');
  const plan = sub ? STORE_PLANS[sub.planId] : STORE_PLANS.free;

  if (!plan.features.marketInsights) {
    return res.status(403).json({
      error: 'Market insights require Professional plan or higher.',
      upgrade: { plan: 'professional', price: '$149/mo', url: '/api/monetization/b2b/subscribe' }
    });
  }

  // Generate market insights (simulated - in production, derived from real search/order data)
  const storeInventory = db.inventory.filter(i => i.storeId === req.params.storeId);
  const allSearches = ['drill', 'hangers', 'batteries', 'charger', 'light bulb', 'tape measure', 'work gloves', 'extension cord', 'power bank', 'hdmi cable'];

  const insights = {
    storeId: req.params.storeId,
    period: 'last_30_days',
    demandSignals: {
      topSearches: allSearches.slice(0, 5).map((term, i) => ({
        term,
        searchVolume: Math.floor(Math.random() * 500) + 100,
        trend: ['rising', 'stable', 'rising', 'rising', 'stable'][i],
        yourInventory: storeInventory.some(inv => inv.productName.toLowerCase().includes(term)) ? 'in_stock' : 'missing',
      })),
      missedOpportunities: allSearches.slice(5).map(term => ({
        term,
        searchVolume: Math.floor(Math.random() * 200) + 50,
        reason: 'Product not in your inventory',
        estimatedRevenue: `$${(Math.random() * 500 + 100).toFixed(0)}/mo`,
      })),
    },
    competitorBenchmarks: plan.features.marketInsights === 'full' ? {
      avgPriceIndex: 0.97, // Your prices are 3% below area average
      inventoryCoverage: '73%', // You carry 73% of top-searched items
      deliverySpeed: 'faster_than_avg',
      areaCompetitors: 5,
    } : 'Upgrade to Enterprise for competitor benchmarks',
    recommendations: [
      { type: 'stock', message: 'Add USB-C cables — high search volume, not in your inventory', impact: 'high' },
      { type: 'price', message: 'Your LED bulbs are 12% above area average. Consider a price match.', impact: 'medium' },
      { type: 'promotion', message: 'Run a promoted listing for "drill" — searches are up 40% this month.', impact: 'high' },
    ],
    generatedAt: new Date().toISOString(),
  };

  res.json(insights);
});


// ============================================
// 4. STORE BILLING & REVENUE DASHBOARD
// ============================================

// GET /api/monetization/b2b/billing/:storeId - Billing summary
router.get('/billing/:storeId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const sub = db.subscriptions.find(s => s.storeId === req.params.storeId && s.status === 'active');
  const plan = sub ? STORE_PLANS[sub.planId] : STORE_PLANS.free;

  // Calculate commissions from orders
  const storeOrders = db.orders.filter(o =>
    o.items.some(i => i.storeId === req.params.storeId) && o.status !== 'cancelled'
  );
  const grossRevenue = storeOrders.reduce((sum, o) =>
    sum + o.items.filter(i => i.storeId === req.params.storeId).reduce((s, i) => s + i.lineTotal, 0), 0
  );
  const platformCommission = grossRevenue * plan.commission;
  const deliveryCommissions = storeOrders
    .filter(o => o.fulfillment === 'delivery')
    .reduce((sum, o) => sum + (o.deliveryFee * plan.features.deliveryCommission), 0);

  // Ad spend
  const promos = db.promotions.filter(p => p.storeId === req.params.storeId);
  const adSpend = promos.reduce((s, p) => s + p.totalSpent, 0);

  const billing = {
    storeId: req.params.storeId,
    currentPlan: {
      name: plan.name,
      monthlyFee: plan.price,
      commissionRate: `${(plan.commission * 100).toFixed(1)}%`,
    },
    currentPeriod: {
      start: sub?.currentPeriodStart || new Date().toISOString(),
      end: sub?.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    revenue: {
      grossSales: parseFloat(grossRevenue.toFixed(2)),
      platformCommission: parseFloat(platformCommission.toFixed(2)),
      deliveryCommissions: parseFloat(deliveryCommissions.toFixed(2)),
      netRevenue: parseFloat((grossRevenue - platformCommission - deliveryCommissions).toFixed(2)),
    },
    charges: {
      subscriptionFee: sub ? sub.totalMonthly : 0,
      adSpend: parseFloat(adSpend.toFixed(2)),
      totalCharges: parseFloat(((sub ? sub.totalMonthly : 0) + adSpend + platformCommission + deliveryCommissions).toFixed(2)),
    },
    orderCount: storeOrders.length,
    // Payment integration point
    paymentMethod: null,
    stripeCustomerId: null,
  };

  res.json(billing);
});

module.exports = router;
module.exports.STORE_PLANS = STORE_PLANS;
module.exports.INVENTORY_SOFTWARE_PLANS = INVENTORY_SOFTWARE_PLANS;
