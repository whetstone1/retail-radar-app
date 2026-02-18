/**
 * Stripe Configuration
 * Maps Retail Radar plans to Stripe price IDs.
 * 
 * In production, set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET as env vars.
 * Run `node backend/config/stripe-setup.js` to create products/prices in Stripe.
 */

module.exports = {
  secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key_for_development',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_secret',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock_key_for_development',

  // Base URL for success/cancel redirects
  appUrl: process.env.APP_URL || 'http://localhost:3001',

  // B2B Platform Plans → Stripe Price IDs
  b2bPrices: {
    free:         { monthly: null }, // No charge
    starter:      { monthly: process.env.STRIPE_B2B_STARTER_MONTHLY || 'price_b2b_starter_monthly' },
    professional: { monthly: process.env.STRIPE_B2B_PROFESSIONAL_MONTHLY || 'price_b2b_professional_monthly' },
    enterprise:   { monthly: process.env.STRIPE_B2B_ENTERPRISE_MONTHLY || 'price_b2b_enterprise_monthly' },
  },

  // B2B Inventory Software Add-ons
  b2bInventoryPrices: {
    inventory_basic: { monthly: process.env.STRIPE_INV_BASIC || 'price_inv_basic_monthly' },
    inventory_pro:   { monthly: process.env.STRIPE_INV_PRO || 'price_inv_pro_monthly' },
    inventory_enterprise: { monthly: process.env.STRIPE_INV_ENT || 'price_inv_enterprise_monthly' },
  },

  // Consumer Plans → Stripe Price IDs
  consumerPrices: {
    free:      { monthly: null, annual: null },
    radar_plus: {
      monthly: process.env.STRIPE_CONSUMER_PLUS_MONTHLY || 'price_consumer_plus_monthly',
      annual:  process.env.STRIPE_CONSUMER_PLUS_ANNUAL || 'price_consumer_plus_annual',
    },
    radar_pro: {
      monthly: process.env.STRIPE_CONSUMER_PRO_MONTHLY || 'price_consumer_pro_monthly',
      annual:  process.env.STRIPE_CONSUMER_PRO_ANNUAL || 'price_consumer_pro_annual',
    },
  },

  // Trial period (days)
  trialDays: 7,
};
