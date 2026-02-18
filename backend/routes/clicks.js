/**
 * Click Tracking & Affiliate Redirect Routes
 * 
 * Tracks outbound clicks to retailer sites for analytics and affiliate revenue.
 * Two modes:
 *   1. Direct: Frontend opens retailer URL directly (buyUrl in search results)
 *   2. Redirect: Frontend calls /api/click/go?... and we redirect after logging
 * 
 * The redirect mode is better for tracking but adds latency.
 * We support both — frontend uses direct links but fires a tracking beacon.
 */
const express = require('express');
const router = express.Router();
const { generateProductUrl, brandToKey } = require('../utils/deep-links');
const { optionalAuth } = require('../middleware/auth');

// In-memory click log (in production, persist to DB or analytics service)
const clickLog = [];

// POST /api/click/track — Fire-and-forget tracking beacon
router.post('/track', optionalAuth, (req, res) => {
  const { productSku, productName, retailerKey, storeId, price, action } = req.body;

  clickLog.push({
    id: clickLog.length + 1,
    productSku,
    productName,
    retailerKey,
    storeId,
    price,
    action: action || 'click', // 'click', 'delivery', 'pickup'
    userId: req.user?.id || null,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
  });

  res.json({ tracked: true });
});

// GET /api/click/go — Redirect through tracking (alternative to direct links)
router.get('/go', optionalAuth, (req, res) => {
  const { retailer, product, brand, sku, storeId, action } = req.query;

  if (!retailer || !product) {
    return res.status(400).json({ error: 'retailer and product params required' });
  }

  // Log the click
  clickLog.push({
    id: clickLog.length + 1,
    productSku: sku || null,
    productName: product,
    retailerKey: retailer,
    storeId: storeId || null,
    action: action || 'click',
    userId: req.user?.id || null,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
  });

  // Generate affiliate URL and redirect
  const url = generateProductUrl(retailer, product, { brand });
  if (!url) {
    return res.status(404).json({ error: 'Unknown retailer' });
  }

  res.redirect(302, url);
});

// GET /api/click/stats — Click analytics (admin/dashboard)
router.get('/stats', (req, res) => {
  const { days = 30 } = req.query;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const recentClicks = clickLog.filter(c => new Date(c.timestamp) >= since);

  // Aggregate by retailer
  const byRetailer = {};
  for (const click of recentClicks) {
    if (!byRetailer[click.retailerKey]) {
      byRetailer[click.retailerKey] = { clicks: 0, uniqueProducts: new Set() };
    }
    byRetailer[click.retailerKey].clicks++;
    if (click.productSku) byRetailer[click.retailerKey].uniqueProducts.add(click.productSku);
  }

  // Aggregate by action
  const byAction = {};
  for (const click of recentClicks) {
    byAction[click.action] = (byAction[click.action] || 0) + 1;
  }

  // Top products
  const productClicks = {};
  for (const click of recentClicks) {
    const key = click.productName || click.productSku || 'unknown';
    productClicks[key] = (productClicks[key] || 0) + 1;
  }
  const topProducts = Object.entries(productClicks)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, clicks]) => ({ name, clicks }));

  res.json({
    period: `${days} days`,
    totalClicks: recentClicks.length,
    byRetailer: Object.fromEntries(
      Object.entries(byRetailer).map(([k, v]) => [k, { clicks: v.clicks, uniqueProducts: v.uniqueProducts.size }])
    ),
    byAction,
    topProducts,
  });
});

module.exports = router;
