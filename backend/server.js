/**
 * Retail Radar - Backend Server
 * Enhanced with: Auth, Validation, Advanced Search, Geolocation,
 * Inventory Management, Orders, Notifications
 * 
 * Run: node backend/server.js
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const { errorHandler, requestLogger } = require('./middleware/validation');

// Import routes
const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const storeRoutes = require('./routes/stores');
const inventoryRoutes = require('./routes/inventory');
const orderRoutes = require('./routes/orders');
const notificationRoutes = require('./routes/notifications');
const monetizationB2BRoutes = require('./routes/monetization-b2b');
const monetizationConsumerRoutes = require('./routes/monetization-consumer');
const scraperRoutes = require('./routes/scraper');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payments');

// Import database for stats
const db = require('./models/database');

const app = express();

// ============================================
// Security & Performance Middleware
// ============================================
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for the website
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors({
  origin: '*', // In production, restrict to your domains
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// JSON parsing - skip for Stripe webhook (needs raw body for signature verification)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') return next();
  express.json({ limit: '10mb' })(req, res, next);
});
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ============================================
// Serve Static Website
// ============================================
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ============================================
// Health Check & API Info
// ============================================
app.get('/api/health', (req, res) => {
  const allStores = db.getAllStores();
  res.json({
    status: 'ok',
    version: '2.0.0',
    name: 'Retail Radar API',
    stats: {
      retailers: Object.keys(db.STORE_CHAINS).length,
      stores: allStores.length,
      products: db.PRODUCTS.length,
      inventoryItems: db.inventory.length,
      users: db.users.length,
      orders: db.orders.length,
      cities: [...new Set(allStores.map(s => s.city))].length,
    },
    endpoints: {
      auth: '/api/auth (register, login, profile)',
      search: '/api/search (advanced search with filters)',
      stores: '/api/stores (browse, nearby, details)',
      inventory: '/api/inventory (CRUD, batch, stats)',
      orders: '/api/orders (create, track, cancel)',
      notifications: '/api/notifications (list, read, delete)',
      monetization_b2b: '/api/monetization/b2b (plans, subscribe, promote, insights, billing)',
      monetization_consumer: '/api/monetization/consumer (plans, subscribe, fees, ads)',
      scraper: '/api/scraper (run, jobs, retailers)',
      dashboard: '/api/dashboard (overview, inventory, orders, analytics)',
      payments: '/api/payments (checkout, billing-portal, invoices, webhook)',
    },
    timestamp: new Date().toISOString(),
  });
});

// API documentation
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Retail Radar API v2.0',
    description: 'Search engine for local retail. Shop local, from home.',
    baseUrl: `http://localhost:${config.port}/api`,
    authentication: 'Bearer token (JWT) in Authorization header',
    endpoints: [
      { method: 'POST', path: '/api/auth/register', desc: 'Register new user', auth: false, body: '{ email, password, name, role? }' },
      { method: 'POST', path: '/api/auth/login', desc: 'Login', auth: false, body: '{ email, password }' },
      { method: 'GET', path: '/api/auth/profile', desc: 'Get profile', auth: true },
      { method: 'PUT', path: '/api/auth/profile', desc: 'Update profile', auth: true },
      { method: 'POST', path: '/api/auth/favorites', desc: 'Add favorite', auth: true },
      { method: 'DELETE', path: '/api/auth/favorites/:sku', desc: 'Remove favorite', auth: true },
      { method: 'POST', path: '/api/search', desc: 'Advanced search', auth: false, body: '{ query, lat?, lng?, radius?, category?, minPrice?, maxPrice?, sortBy?, page?, limit? }' },
      { method: 'GET', path: '/api/search/categories', desc: 'List categories', auth: false },
      { method: 'GET', path: '/api/search/suggestions?q=...', desc: 'Autocomplete', auth: false },
      { method: 'GET', path: '/api/stores', desc: 'List stores', auth: false, query: 'lat, lng, radius, retailer, city, state' },
      { method: 'GET', path: '/api/stores/retailers', desc: 'List retailer chains', auth: false },
      { method: 'GET', path: '/api/stores/nearby', desc: 'Nearby stores', auth: false, query: 'lat, lng, radius' },
      { method: 'GET', path: '/api/stores/:storeId', desc: 'Store details + inventory', auth: false },
      { method: 'POST', path: '/api/inventory', desc: 'Add item', auth: 'store_owner' },
      { method: 'PUT', path: '/api/inventory/:id', desc: 'Update item', auth: 'store_owner' },
      { method: 'DELETE', path: '/api/inventory/:id', desc: 'Remove item', auth: 'store_owner' },
      { method: 'POST', path: '/api/inventory/batch', desc: 'Batch add/update', auth: 'store_owner' },
      { method: 'GET', path: '/api/inventory/stats/:storeId', desc: 'Store analytics', auth: 'store_owner' },
      { method: 'POST', path: '/api/orders', desc: 'Create order', auth: true, body: '{ items: [{inventoryId, quantity}], fulfillment, deliveryAddress? }' },
      { method: 'GET', path: '/api/orders', desc: 'List orders', auth: true },
      { method: 'GET', path: '/api/orders/:id', desc: 'Order details', auth: true },
      { method: 'PUT', path: '/api/orders/:id/status', desc: 'Update status', auth: 'admin/store_owner' },
      { method: 'POST', path: '/api/orders/:id/cancel', desc: 'Cancel order', auth: true },
      { method: 'GET', path: '/api/notifications', desc: 'List notifications', auth: true },
      { method: 'PUT', path: '/api/notifications/:id/read', desc: 'Mark read', auth: true },
      { method: 'PUT', path: '/api/notifications/read-all', desc: 'Mark all read', auth: true },
      // B2B Monetization
      { method: 'GET', path: '/api/monetization/b2b/plans', desc: 'List store subscription plans + inventory software tiers', auth: false },
      { method: 'POST', path: '/api/monetization/b2b/subscribe', desc: 'Subscribe store to platform plan', auth: 'store_owner', body: '{ storeId, planId, inventoryPlanId? }' },
      { method: 'GET', path: '/api/monetization/b2b/subscription/:storeId', desc: 'Get store subscription status', auth: 'store_owner' },
      { method: 'POST', path: '/api/monetization/b2b/cancel', desc: 'Cancel store subscription', auth: 'store_owner', body: '{ storeId }' },
      { method: 'POST', path: '/api/monetization/b2b/promote', desc: 'Create promoted listing / ad', auth: 'store_owner', body: '{ storeId, productSkus?, placement, dailyBudget, startDate?, endDate? }' },
      { method: 'GET', path: '/api/monetization/b2b/promotions/:storeId', desc: 'List store promotions & ad stats', auth: 'store_owner' },
      { method: 'GET', path: '/api/monetization/b2b/insights/:storeId', desc: 'Market insights (Professional+)', auth: 'store_owner' },
      { method: 'GET', path: '/api/monetization/b2b/billing/:storeId', desc: 'Store billing summary', auth: 'store_owner' },
      // Consumer Monetization
      { method: 'GET', path: '/api/monetization/consumer/plans', desc: 'List consumer membership plans', auth: false },
      { method: 'POST', path: '/api/monetization/consumer/subscribe', desc: 'Subscribe to consumer plan', auth: true, body: '{ planId, billingInterval? }' },
      { method: 'GET', path: '/api/monetization/consumer/membership', desc: 'Get current membership + stats', auth: true },
      { method: 'POST', path: '/api/monetization/consumer/cancel', desc: 'Cancel consumer membership', auth: true },
      { method: 'POST', path: '/api/monetization/consumer/calculate-fees', desc: 'Calculate order fees based on plan', auth: false, body: '{ subtotal, fulfillment?, itemCount? }' },
      { method: 'GET', path: '/api/monetization/consumer/ad-placements', desc: 'Get ad slots for page context', auth: false, query: 'page, category?, query?' },
      { method: 'POST', path: '/api/monetization/consumer/ad-click', desc: 'Track ad click', auth: false, body: '{ promotionId }' },
      // Payments (Stripe)
      { method: 'GET', path: '/api/payments/config', desc: 'Get Stripe publishable key', auth: false },
      { method: 'POST', path: '/api/payments/create-customer', desc: 'Create Stripe customer for user', auth: true },
      { method: 'POST', path: '/api/payments/b2b/checkout', desc: 'Create B2B checkout session', auth: 'store_owner', body: '{ storeId, planId, inventoryPlanId? }' },
      { method: 'POST', path: '/api/payments/b2b/change-plan', desc: 'Change B2B plan', auth: 'store_owner', body: '{ storeId, newPlanId }' },
      { method: 'POST', path: '/api/payments/b2b/cancel', desc: 'Cancel B2B subscription via Stripe', auth: 'store_owner', body: '{ storeId, immediate? }' },
      { method: 'POST', path: '/api/payments/consumer/checkout', desc: 'Create consumer checkout session', auth: true, body: '{ planId, billingInterval? }' },
      { method: 'POST', path: '/api/payments/consumer/change-plan', desc: 'Change consumer plan', auth: true, body: '{ newPlanId, billingInterval? }' },
      { method: 'POST', path: '/api/payments/consumer/cancel', desc: 'Cancel consumer subscription via Stripe', auth: true, body: '{ immediate? }' },
      { method: 'POST', path: '/api/payments/billing-portal', desc: 'Get Stripe billing portal URL', auth: true, body: '{ returnUrl? }' },
      { method: 'GET', path: '/api/payments/payment-methods', desc: 'List payment methods', auth: true },
      { method: 'GET', path: '/api/payments/invoices', desc: 'List invoices', auth: true },
      { method: 'GET', path: '/api/payments/session/:sessionId', desc: 'Verify checkout session', auth: true },
      { method: 'POST', path: '/api/payments/webhook', desc: 'Stripe webhook endpoint', auth: false },
    ]
  });
});

// ============================================
// Mount Routes
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/monetization/b2b', monetizationB2BRoutes);
app.use('/api/monetization/consumer', monetizationConsumerRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);

// ============================================
// Serve portal
// ============================================
app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'portal.html'));
});

// Serve website for all non-API routes (SPA fallback)
// ============================================
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  }
});

// ============================================
// Error Handler (must be last)
// ============================================
app.use(errorHandler);

// ============================================
// Start Server (async for SQLite init)
// ============================================
async function startServer() {
  // Initialize SQLite persistence
  await db.init();
  
  return new Promise((resolve) => {
    const server = app.listen(config.port, () => {
      const allStores = db.getAllStores();
      const stats = db.sqlite.getStats();
      const cities = [...new Set(allStores.map(s => s.city))];
      const states = [...new Set(allStores.map(s => s.state))];
      console.log('');
      console.log('╔═════════════════════════════════════════════════════════╗');
      console.log('║   🔴 RETAIL RADAR v5.0 - Production DB                  ║');
      console.log('║   Shop local, from home.™                              ║');
      console.log('╠═════════════════════════════════════════════════════════╣');
      console.log(`║   🌐 Website:  http://localhost:${config.port}                  ║`);
      console.log(`║   📡 API:      http://localhost:${config.port}/api              ║`);
      console.log(`║   🏪 Portal:   http://localhost:${config.port}/portal           ║`);
      console.log(`║   💾 DB:       SQLite (persistent)                      ║`);
      console.log('╠═════════════════════════════════════════════════════════╣');
      console.log(`║   🏬 ${String(Object.keys(db.STORE_CHAINS).length).padEnd(3)} Retailers                                       ║`);
      console.log(`║   🏪 ${String(stats.stores).padEnd(4)} Stores across ${cities.length} cities, ${states.length} states          ║`);
      console.log(`║   📦 ${String(stats.products).padEnd(4)} Products in ${stats.inventory.toLocaleString()} inventory records    ║`);
      console.log('╚═════════════════════════════════════════════════════════╝');
      console.log('');
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch(err => { console.error('Failed to start:', err); process.exit(1); });
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.initDb = () => db.init();
