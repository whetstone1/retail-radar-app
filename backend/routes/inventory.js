/**
 * Inventory Management Routes (Store Owner)
 * CRUD for inventory items, batch processing
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validation');
const { inventory, PRODUCTS, persist } = require('../models/database');

// POST /api/inventory - Add product to store inventory
router.post('/', authenticate, authorize('store_owner', 'admin'), rules.inventoryItem, validate, (req, res) => {
  const { storeId, productName, price, quantity, category, keywords = [], productSku } = req.body;

  if (!storeId) return res.status(400).json({ error: 'storeId required' });

  const item = {
    id: uuidv4(),
    storeId,
    retailer: req.body.retailer || 'independent',
    productSku: productSku || `CUSTOM-${uuidv4().slice(0, 8).toUpperCase()}`,
    productName,
    price: parseFloat(price),
    quantity: parseInt(quantity),
    category: category || 'uncategorized',
    keywords,
    inStock: parseInt(quantity) > 0,
    lastUpdated: new Date().toISOString(),
    addedBy: req.user.id,
  };

  inventory.push(item);
    persist.inventory(item);
  res.status(201).json({ message: 'Item added to inventory', item });
});

// PUT /api/inventory/:id - Update inventory item
router.put('/:id', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const idx = inventory.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Inventory item not found' });

  const item = inventory[idx];
  const { price, quantity, productName } = req.body;

  if (price !== undefined) item.price = parseFloat(price);
  if (quantity !== undefined) {
    item.quantity = parseInt(quantity);
    item.inStock = item.quantity > 0;
  }
  if (productName) item.productName = productName;
  item.lastUpdated = new Date().toISOString();

  res.json({ message: 'Item updated', item });
});

// DELETE /api/inventory/:id - Remove inventory item
router.delete('/:id', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const idx = inventory.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Inventory item not found' });

  const removed = inventory.splice(idx, 1)[0];
  res.json({ message: 'Item removed', item: removed });
});

// POST /api/inventory/batch - Batch add/update inventory
router.post('/batch', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const { storeId, items } = req.body;
  if (!storeId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'storeId and items[] required' });
  }
  if (items.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 items per batch' });
  }

  const added = [];
  const updated = [];
  const errors = [];

  for (const item of items) {
    try {
      if (!item.productName || item.price === undefined) {
        errors.push({ item, error: 'Missing productName or price' });
        continue;
      }

      const existing = inventory.find(i => i.storeId === storeId && i.productName === item.productName);
      if (existing) {
        existing.price = parseFloat(item.price);
        existing.quantity = parseInt(item.quantity || existing.quantity);
        existing.inStock = existing.quantity > 0;
        existing.lastUpdated = new Date().toISOString();
        updated.push(existing);
      } else {
        const newItem = {
          id: uuidv4(),
          storeId,
          retailer: item.retailer || 'independent',
          productSku: item.productSku || `CUSTOM-${uuidv4().slice(0, 8).toUpperCase()}`,
          productName: item.productName,
          price: parseFloat(item.price),
          quantity: parseInt(item.quantity || 0),
          inStock: parseInt(item.quantity || 0) > 0,
          lastUpdated: new Date().toISOString(),
          addedBy: req.user.id,
        };
        inventory.push(newItem);
          persist.inventory(newItem);
        added.push(newItem);
      }
    } catch (e) {
      errors.push({ item, error: e.message });
    }
  }

  res.json({
    message: `Batch processed: ${added.length} added, ${updated.length} updated, ${errors.length} errors`,
    added: added.length,
    updated: updated.length,
    errors
  });
});

// GET /api/inventory/stats/:storeId - Inventory analytics for a store
router.get('/stats/:storeId', authenticate, authorize('store_owner', 'admin'), (req, res) => {
  const storeItems = inventory.filter(i => i.storeId === req.params.storeId);
  const inStock = storeItems.filter(i => i.inStock);
  const outOfStock = storeItems.filter(i => !i.inStock);
  const totalValue = inStock.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const categoryBreakdown = {};
  for (const item of storeItems) {
    const cat = item.category || 'uncategorized';
    if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, value: 0 };
    categoryBreakdown[cat].count++;
    categoryBreakdown[cat].value += item.price * item.quantity;
  }

  res.json({
    storeId: req.params.storeId,
    totalProducts: storeItems.length,
    inStock: inStock.length,
    outOfStock: outOfStock.length,
    totalInventoryValue: parseFloat(totalValue.toFixed(2)),
    avgPrice: storeItems.length ? parseFloat((storeItems.reduce((s, i) => s + i.price, 0) / storeItems.length).toFixed(2)) : 0,
    categoryBreakdown,
  });
});

module.exports = router;
