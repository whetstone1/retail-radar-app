/**
 * Store Owner Dashboard API
 * Aggregates inventory, orders, analytics, billing, and promotions
 * into dashboard-ready endpoints for the store portal.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../models/database');

// ============================================
// STORE CLAIM / REGISTRATION
// ============================================

// POST /api/dashboard/claim-store - Claim a store
router.post('/claim-store', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId } = req.body;
  if (!storeId) return res.status(400).json({ error: 'storeId required' });

  const allStores = db.getAllStores();
  const store = allStores.find(s => s.storeId === storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });

  // Check if already claimed
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!user.claimedStores) user.claimedStores = [];
  if (user.claimedStores.includes(storeId)) {
    return res.status(400).json({ error: 'Store already claimed' });
  }

  user.claimedStores.push(storeId);
  res.status(200).json({
    message: 'Store claimed successfully',
    store: { storeId: store.storeId, name: store.name, address: store.address },
  });
});

// GET /api/dashboard/my-stores - List claimed stores
router.get('/my-stores', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  const claimedIds = user?.claimedStores || [];
  const allStores = db.getAllStores();

  const stores = claimedIds.map(id => {
    const store = allStores.find(s => s.storeId === id);
    if (!store) return null;

    const inv = db.inventory.filter(i => i.storeId === id);
    const storeOrders = db.orders.filter(o => o.storeId === id);
    const sub = db.subscriptions.find(s => s.storeId === id && s.status === 'active');

    return {
      ...store,
      inventoryCount: inv.length,
      inStockCount: inv.filter(i => i.inStock && i.quantity > 0).length,
      orderCount: storeOrders.length,
      subscription: sub ? { planId: sub.planId, status: sub.status } : null,
    };
  }).filter(Boolean);

  res.json({ stores });
});

// GET /api/dashboard/available-stores - List stores available to claim
router.get('/available-stores', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { city, state, retailer, q } = req.query;
  let stores = db.getAllStores();

  if (city) stores = stores.filter(s => s.city?.toLowerCase().includes(city.toLowerCase()));
  if (state) stores = stores.filter(s => s.state?.toLowerCase() === state.toLowerCase());
  if (retailer) stores = stores.filter(s => s.retailer === retailer);
  if (q) stores = stores.filter(s => s.name?.toLowerCase().includes(q.toLowerCase()));

  // Check which are already claimed
  const allUsers = db.users.filter(u => u.claimedStores?.length > 0);
  const claimedSet = new Set();
  allUsers.forEach(u => u.claimedStores.forEach(id => claimedSet.add(id)));

  const result = stores.map(s => ({
    storeId: s.storeId,
    name: s.name,
    address: s.address,
    city: s.city,
    state: s.state,
    retailer: s.retailer,
    brand: s.brand,
    claimed: claimedSet.has(s.storeId),
  }));

  res.json({ stores: result, total: result.length });
});

// ============================================
// DASHBOARD OVERVIEW
// ============================================

// GET /api/dashboard/overview/:storeId - Full dashboard data
router.get('/overview/:storeId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId } = req.params;
  const allStores = db.getAllStores();
  const store = allStores.find(s => s.storeId === storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });

  // Inventory
  const inv = db.inventory.filter(i => i.storeId === storeId);
  const inStock = inv.filter(i => i.inStock && i.quantity > 0);
  const lowStock = inv.filter(i => i.quantity > 0 && i.quantity <= 5);
  const outOfStock = inv.filter(i => !i.inStock || i.quantity === 0);
  const totalValue = inv.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const avgPrice = inv.length > 0 ? inv.reduce((s, i) => s + i.price, 0) / inv.length : 0;

  // Orders
  const storeOrders = db.orders.filter(o => o.storeId === storeId);
  const pendingOrders = storeOrders.filter(o => o.status === 'pending' || o.status === 'confirmed');
  const completedOrders = storeOrders.filter(o => o.status === 'delivered' || o.status === 'picked_up');
  const cancelledOrders = storeOrders.filter(o => o.status === 'cancelled');
  const totalRevenue = completedOrders.reduce((s, o) => s + (o.total || 0), 0);

  // Today's metrics
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = storeOrders.filter(o => o.createdAt?.startsWith(today));
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);

  // Subscription
  const sub = db.subscriptions.find(s => s.storeId === storeId && s.status === 'active');

  // Promotions
  const promos = db.promotions.filter(p => p.storeId === storeId);
  const activePromos = promos.filter(p => p.status === 'active');
  const totalAdSpend = promos.reduce((s, p) => s + (p.totalSpent || 0), 0);
  const totalImpressions = promos.reduce((s, p) => s + (p.impressions || 0), 0);
  const totalClicks = promos.reduce((s, p) => s + (p.clicks || 0), 0);

  // Category breakdown
  const categories = {};
  inv.forEach(i => {
    const cat = i.category || 'uncategorized';
    if (!categories[cat]) categories[cat] = { count: 0, value: 0, avgPrice: 0 };
    categories[cat].count++;
    categories[cat].value += i.price * i.quantity;
  });
  Object.values(categories).forEach(c => { c.avgPrice = c.value / Math.max(c.count, 1); });

  res.json({
    store: { storeId: store.storeId, name: store.name, address: store.address, city: store.city, state: store.state, brand: store.brand },
    inventory: {
      total: inv.length,
      inStock: inStock.length,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      totalValue: parseFloat(totalValue.toFixed(2)),
      avgPrice: parseFloat(avgPrice.toFixed(2)),
      categories,
    },
    orders: {
      total: storeOrders.length,
      pending: pendingOrders.length,
      completed: completedOrders.length,
      cancelled: cancelledOrders.length,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      today: { count: todayOrders.length, revenue: parseFloat(todayRevenue.toFixed(2)) },
    },
    subscription: sub ? {
      planId: sub.planId,
      status: sub.status,
      totalMonthly: sub.totalMonthly,
      features: sub.features,
      currentPeriodEnd: sub.currentPeriodEnd,
    } : { planId: 'none', status: 'none', message: 'No active subscription' },
    promotions: {
      active: activePromos.length,
      total: promos.length,
      totalSpend: parseFloat(totalAdSpend.toFixed(2)),
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? parseFloat((totalClicks / totalImpressions * 100).toFixed(2)) : 0,
    },
  });
});

// ============================================
// INVENTORY MANAGEMENT
// ============================================

// GET /api/dashboard/inventory/:storeId - Full inventory list with filters
router.get('/inventory/:storeId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId } = req.params;
  const { category, inStock, lowStock, sort, q, page = 1, limit = 50 } = req.query;

  let items = db.inventory.filter(i => i.storeId === storeId);

  if (category) items = items.filter(i => i.category === category);
  if (inStock === 'true') items = items.filter(i => i.inStock && i.quantity > 0);
  if (inStock === 'false') items = items.filter(i => !i.inStock || i.quantity === 0);
  if (lowStock === 'true') items = items.filter(i => i.quantity > 0 && i.quantity <= 5);
  if (q) {
    const lower = q.toLowerCase();
    items = items.filter(i => i.productName?.toLowerCase().includes(lower) || i.productSku?.toLowerCase().includes(lower));
  }

  // Sort
  if (sort === 'price_asc') items.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') items.sort((a, b) => b.price - a.price);
  else if (sort === 'quantity_asc') items.sort((a, b) => a.quantity - b.quantity);
  else if (sort === 'quantity_desc') items.sort((a, b) => b.quantity - a.quantity);
  else if (sort === 'name') items.sort((a, b) => a.productName.localeCompare(b.productName));
  else items.sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''));

  const total = items.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paged = items.slice(offset, offset + parseInt(limit));

  res.json({
    items: paged,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

// POST /api/dashboard/inventory/:storeId/add - Add product
router.post('/inventory/:storeId/add', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId } = req.params;
  const { productName, productSku, price, quantity, category, brand, keywords, imageUrl } = req.body;

  if (!productName || price === undefined) {
    return res.status(400).json({ error: 'productName and price required' });
  }

  const item = {
    id: uuidv4(),
    storeId,
    productSku: productSku || `CUST-${uuidv4().slice(0, 8).toUpperCase()}`,
    productName,
    price: parseFloat(price),
    quantity: parseInt(quantity) || 0,
    category: category || 'uncategorized',
    brand: brand || '',
    keywords: keywords || productName.toLowerCase().split(' ').filter(w => w.length > 2),
    imageUrl: imageUrl || '',
    inStock: (parseInt(quantity) || 0) > 0,
    lastUpdated: new Date().toISOString(),
    source: 'manual',
  };

  db.inventory.push(item);
  res.status(201).json({ message: 'Product added', item });
});

// PUT /api/dashboard/inventory/:storeId/:itemId - Update product
router.put('/inventory/:storeId/:itemId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId, itemId } = req.params;
  const item = db.inventory.find(i => i.id === itemId && i.storeId === storeId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { productName, price, quantity, category, brand, inStock } = req.body;
  if (productName !== undefined) item.productName = productName;
  if (price !== undefined) item.price = parseFloat(price);
  if (quantity !== undefined) { item.quantity = parseInt(quantity); item.inStock = parseInt(quantity) > 0; }
  if (category !== undefined) item.category = category;
  if (brand !== undefined) item.brand = brand;
  if (inStock !== undefined) item.inStock = inStock;
  item.lastUpdated = new Date().toISOString();

  res.json({ message: 'Product updated', item });
});

// DELETE /api/dashboard/inventory/:storeId/:itemId - Remove product
router.delete('/inventory/:storeId/:itemId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId, itemId } = req.params;
  const idx = db.inventory.findIndex(i => i.id === itemId && i.storeId === storeId);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  db.inventory.splice(idx, 1);
  res.json({ message: 'Product removed' });
});

// POST /api/dashboard/inventory/:storeId/bulk-update - Bulk price/quantity update
router.post('/inventory/:storeId/bulk-update', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId } = req.params;
  const { updates } = req.body; // Array of { itemId, price?, quantity? }
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates array required' });

  let updated = 0;
  for (const u of updates) {
    const item = db.inventory.find(i => i.id === u.itemId && i.storeId === storeId);
    if (item) {
      if (u.price !== undefined) item.price = parseFloat(u.price);
      if (u.quantity !== undefined) { item.quantity = parseInt(u.quantity); item.inStock = parseInt(u.quantity) > 0; }
      item.lastUpdated = new Date().toISOString();
      updated++;
    }
  }
  res.json({ message: `${updated} items updated`, updated });
});

// ============================================
// ORDER MANAGEMENT
// ============================================

// GET /api/dashboard/orders/:storeId - Store's orders
router.get('/orders/:storeId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  let storeOrders = db.orders.filter(o => o.storeId === storeId);
  if (status) storeOrders = storeOrders.filter(o => o.status === status);

  storeOrders.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const total = storeOrders.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paged = storeOrders.slice(offset, offset + parseInt(limit));

  res.json({
    orders: paged,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

// PUT /api/dashboard/orders/:storeId/:orderId/status - Update order status
router.put('/orders/:storeId/:orderId/status', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId, orderId } = req.params;
  const { status } = req.body;

  const validStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'picked_up', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` });
  }

  const order = db.orders.find(o => o.id === orderId && o.storeId === storeId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = status;
  order.updatedAt = new Date().toISOString();

  res.json({ message: `Order status updated to ${status}`, order });
});

// ============================================
// ANALYTICS
// ============================================

// GET /api/dashboard/analytics/:storeId - Store analytics
router.get('/analytics/:storeId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId } = req.params;

  const inv = db.inventory.filter(i => i.storeId === storeId);
  const storeOrders = db.orders.filter(o => o.storeId === storeId);

  // Top products by order frequency (simulated from inventory)
  const topProducts = [...inv]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)
    .map(i => ({ name: i.productName, sku: i.productSku, price: i.price, quantity: i.quantity, category: i.category }));

  // Category distribution
  const catDist = {};
  inv.forEach(i => {
    const cat = i.category || 'other';
    catDist[cat] = (catDist[cat] || 0) + 1;
  });

  // Price distribution
  const priceRanges = { 'Under $5': 0, '$5-$15': 0, '$15-$30': 0, '$30-$50': 0, '$50-$100': 0, 'Over $100': 0 };
  inv.forEach(i => {
    if (i.price < 5) priceRanges['Under $5']++;
    else if (i.price < 15) priceRanges['$5-$15']++;
    else if (i.price < 30) priceRanges['$15-$30']++;
    else if (i.price < 50) priceRanges['$30-$50']++;
    else if (i.price < 100) priceRanges['$50-$100']++;
    else priceRanges['Over $100']++;
  });

  // Simulated daily revenue (last 7 days)
  const dailyRevenue = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOrders = storeOrders.filter(o => o.createdAt?.startsWith(dateStr));
    dailyRevenue.push({
      date: dateStr,
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
      orders: dayOrders.length,
    });
  }

  // Inventory health
  const health = {
    healthy: inv.filter(i => i.quantity > 10).length,
    low: inv.filter(i => i.quantity > 0 && i.quantity <= 10).length,
    out: inv.filter(i => !i.inStock || i.quantity === 0).length,
  };

  res.json({
    topProducts,
    categoryDistribution: catDist,
    priceDistribution: priceRanges,
    dailyRevenue,
    inventoryHealth: health,
    summary: {
      totalProducts: inv.length,
      totalOrders: storeOrders.length,
      avgOrderValue: storeOrders.length > 0
        ? parseFloat((storeOrders.reduce((s, o) => s + (o.total || 0), 0) / storeOrders.length).toFixed(2))
        : 0,
      inventoryValue: parseFloat(inv.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)),
    },
  });
});

module.exports = router;
