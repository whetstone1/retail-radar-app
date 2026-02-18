/**
 * Advanced Search & Filtering Routes
 * Supports: text search, category, price range, distance, sorting, pagination
 */
const express = require('express');
const router = express.Router();
const { validate, rules } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');
const { PRODUCTS, inventory, getAllStores } = require('../models/database');
const { calculateDistance, findNearbyStores, estimateDeliveryTime } = require('../utils/geo');
const { generateProductUrl, generateStoreUrl, brandToKey } = require('../utils/deep-links');
const config = require('../config');

// POST /api/search - Advanced product search
router.post('/', rules.search, validate, optionalAuth, (req, res) => {
  const {
    query: q = '',
    lat,
    lng,
    radius = config.defaultRadius,
    category,
    minPrice,
    maxPrice,
    sortBy = 'relevance',
    sortOrder = 'asc',
    page = 1,
    limit = config.pagination.defaultLimit,
    retailer,
    inStockOnly = true
  } = req.body;

  const userLat = parseFloat(lat) || config.defaultLocation.lat;
  const userLng = parseFloat(lng) || config.defaultLocation.lng;
  const maxRadius = Math.min(parseFloat(radius), config.maxRadius);

  // Step 1: Find matching products by text
  const searchTerms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let matchingProducts = PRODUCTS;

  if (searchTerms.length > 0) {
    matchingProducts = PRODUCTS.map(product => {
      const nameLower = product.name.toLowerCase();
      const keywordStr = product.keywords.join(' ').toLowerCase();
      let score = 0;

      for (const term of searchTerms) {
        if (nameLower.includes(term)) score += 3;
        if (keywordStr.includes(term)) score += 2;
        if (product.category.includes(term)) score += 1;
      }
      return { ...product, relevanceScore: score };
    }).filter(p => p.relevanceScore > 0);
  } else {
    matchingProducts = PRODUCTS.map(p => ({ ...p, relevanceScore: 1 }));
  }

  // Step 2: Filter by category
  if (category) {
    matchingProducts = matchingProducts.filter(p => p.category === category.toLowerCase());
  }

  // Step 3: Filter by retailer
  if (retailer) {
    matchingProducts = matchingProducts.filter(p => p.retailers.includes(retailer.toLowerCase()));
  }

  // Step 4: Get all nearby stores
  const allStores = getAllStores();
  const nearbyStores = findNearbyStores(allStores, userLat, userLng, maxRadius);
  const nearbyStoreIds = new Set(nearbyStores.map(s => s.storeId));
  const storeMap = {};
  for (const s of nearbyStores) storeMap[s.storeId] = s;

  // Step 5: Match products to inventory at nearby stores
  const results = [];
  for (const product of matchingProducts) {
    const productInventory = inventory.filter(inv =>
      inv.productSku === product.sku &&
      nearbyStoreIds.has(inv.storeId) &&
      (!inStockOnly || inv.inStock)
    );

    if (productInventory.length === 0) continue;

    // Apply price filters
    const filteredInv = productInventory.filter(inv => {
      if (minPrice !== undefined && inv.price < parseFloat(minPrice)) return false;
      if (maxPrice !== undefined && inv.price > parseFloat(maxPrice)) return false;
      return true;
    });

    if (filteredInv.length === 0) continue;

    // Find best price and nearest store
    const sortedByPrice = [...filteredInv].sort((a, b) => a.price - b.price);
    const bestPrice = sortedByPrice[0].price;
    const nearestInv = [...filteredInv].sort((a, b) =>
      (storeMap[a.storeId]?.distance || 999) - (storeMap[b.storeId]?.distance || 999)
    )[0];
    const nearestStore = storeMap[nearestInv.storeId];

    results.push({
      product: {
        sku: product.sku,
        name: product.name,
        category: product.category,
        image: product.image,
        brand: product.brand || null,
        basePrice: product.price,
      },
      bestPrice,
      storeCount: filteredInv.length,
      nearestStore: nearestStore ? (() => {
        const rKey = brandToKey(nearestStore.brand);
        return {
          id: nearestStore.storeId,
          name: nearestStore.name,
          brand: nearestStore.brand,
          retailerKey: rKey,
          address: nearestStore.address,
          distance: nearestStore.distance,
          deliveryEstimate: estimateDeliveryTime(nearestStore.distance),
          price: nearestInv.price,
          quantity: nearestInv.quantity,
          buyUrl: rKey ? generateProductUrl(rKey, product.name, { brand: product.brand }) : null,
          storeUrl: rKey ? generateStoreUrl(rKey, userLat, userLng) : null,
        };
      })() : null,
      allStores: filteredInv.slice(0, 5).map(inv => {
        const rKey = brandToKey(storeMap[inv.storeId]?.brand);
        return {
          storeId: inv.storeId,
          name: storeMap[inv.storeId]?.name,
          brand: storeMap[inv.storeId]?.brand,
          retailerKey: rKey,
          distance: storeMap[inv.storeId]?.distance,
          price: inv.price,
          quantity: inv.quantity,
          buyUrl: rKey ? generateProductUrl(rKey, product.name, { brand: product.brand }) : null,
        };
      }),
      relevanceScore: product.relevanceScore,
    });
  }

  // Step 6: Sort results
  switch (sortBy) {
    case 'price':
      results.sort((a, b) => sortOrder === 'desc' ? b.bestPrice - a.bestPrice : a.bestPrice - b.bestPrice);
      break;
    case 'distance':
      results.sort((a, b) => {
        const da = a.nearestStore?.distance || 999;
        const db = b.nearestStore?.distance || 999;
        return sortOrder === 'desc' ? db - da : da - db;
      });
      break;
    case 'name':
      results.sort((a, b) => sortOrder === 'desc' ? b.product.name.localeCompare(a.product.name) : a.product.name.localeCompare(b.product.name));
      break;
    default: // relevance
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Step 7: Paginate
  const totalResults = results.length;
  const totalPages = Math.ceil(totalResults / limit);
  const offset = (page - 1) * limit;
  const paginatedResults = results.slice(offset, offset + limit);

  res.json({
    query: q,
    location: { lat: userLat, lng: userLng, radius: maxRadius },
    filters: { category, minPrice, maxPrice, retailer, inStockOnly },
    sorting: { sortBy, sortOrder },
    pagination: { page, limit, totalResults, totalPages },
    results: paginatedResults,
  });
});

// GET /api/search/categories - List all categories
router.get('/categories', (req, res) => {
  const categories = [...new Set(PRODUCTS.map(p => p.category))].sort();
  const categoryCounts = {};
  for (const cat of categories) {
    categoryCounts[cat] = PRODUCTS.filter(p => p.category === cat).length;
  }
  res.json({ categories: categoryCounts });
});

// GET /api/search/suggestions?q=... - Autocomplete suggestions
router.get('/suggestions', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q || q.length < 2) return res.json({ suggestions: [] });

  const suggestions = new Set();
  for (const p of PRODUCTS) {
    if (p.name.toLowerCase().includes(q)) suggestions.add(p.name);
    for (const kw of p.keywords) {
      if (kw.includes(q)) suggestions.add(kw);
    }
  }
  res.json({ suggestions: [...suggestions].slice(0, 10) });
});

module.exports = router;
