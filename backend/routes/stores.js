/**
 * Store Routes: Browse, Search, Details, Nearby
 */
const express = require('express');
const router = express.Router();
const { STORE_CHAINS, inventory, getAllStores } = require('../models/database');
const { findNearbyStores, estimateDeliveryTime } = require('../utils/geo');
const config = require('../config');

// GET /api/stores - List all stores (with optional filters)
router.get('/', (req, res) => {
  const { lat, lng, radius = 10, retailer, city, state, page = 1, limit = 20 } = req.query;

  let stores = getAllStores();

  if (retailer) stores = stores.filter(s => s.retailer === retailer.toLowerCase());
  if (city) stores = stores.filter(s => s.city.toLowerCase().includes(city.toLowerCase()));
  if (state) stores = stores.filter(s => s.state.toLowerCase() === state.toLowerCase());

  if (lat && lng) {
    stores = findNearbyStores(stores, parseFloat(lat), parseFloat(lng), parseFloat(radius));
  }

  const total = stores.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paginated = stores.slice(offset, offset + parseInt(limit));

  res.json({
    pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    stores: paginated
  });
});

// GET /api/stores/retailers - List all retailer chains
router.get('/retailers', (req, res) => {
  const retailers = Object.entries(STORE_CHAINS).map(([key, chain]) => ({
    id: key,
    brand: chain.brand,
    categories: chain.categories,
    storeCount: chain.stores.length,
  }));
  res.json({ retailers });
});

// GET /api/stores/nearby - Find stores near coordinates
router.get('/nearby', (req, res) => {
  const { lat, lng, radius = 10 } = req.query;
  const userLat = parseFloat(lat) || config.defaultLocation.lat;
  const userLng = parseFloat(lng) || config.defaultLocation.lng;

  const stores = findNearbyStores(getAllStores(), userLat, userLng, parseFloat(radius));
  const withEstimates = stores.map(s => ({
    ...s,
    deliveryEstimate: estimateDeliveryTime(s.distance)
  }));

  res.json({
    location: { lat: userLat, lng: userLng, radius: parseFloat(radius) },
    count: withEstimates.length,
    stores: withEstimates
  });
});

// GET /api/stores/:storeId - Store details with inventory
router.get('/:storeId', (req, res) => {
  const allStores = getAllStores();
  const store = allStores.find(s => s.storeId === req.params.storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });

  const storeInventory = inventory
    .filter(inv => inv.storeId === store.storeId && inv.inStock)
    .map(inv => ({
      sku: inv.productSku,
      name: inv.productName,
      price: inv.price,
      quantity: inv.quantity,
      lastUpdated: inv.lastUpdated,
    }));

  res.json({ store, inventory: storeInventory, productCount: storeInventory.length });
});

// GET /api/stores/:storeId/inventory - Full inventory for a store
router.get('/:storeId/inventory', (req, res) => {
  const { category, minPrice, maxPrice, search, page = 1, limit = 50 } = req.query;

  let items = inventory.filter(inv => inv.storeId === req.params.storeId);

  if (category) items = items.filter(i => i.productSku && i.productName.toLowerCase().includes(category.toLowerCase()));
  if (search) items = items.filter(i => i.productName.toLowerCase().includes(search.toLowerCase()));
  if (minPrice) items = items.filter(i => i.price >= parseFloat(minPrice));
  if (maxPrice) items = items.filter(i => i.price <= parseFloat(maxPrice));

  const total = items.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paginated = items.slice(offset, offset + parseInt(limit));

  res.json({
    storeId: req.params.storeId,
    pagination: { page: parseInt(page), limit: parseInt(limit), total },
    inventory: paginated
  });
});

module.exports = router;
