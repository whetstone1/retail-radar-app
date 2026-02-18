/**
 * Order Management Routes
 * Create, track, update orders. Payment integration stubs.
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validation');
const { orders, inventory, notifications, persist } = require('../models/database');

// POST /api/orders - Create a new order
router.post('/', authenticate, rules.order, validate, (req, res) => {
  const { items, fulfillment, deliveryAddress, notes } = req.body;

  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const invItem = inventory.find(i => i.id === item.inventoryId);
    if (!invItem) {
      return res.status(400).json({ error: `Inventory item not found: ${item.inventoryId}` });
    }
    if (!invItem.inStock || invItem.quantity < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for ${invItem.productName}` });
    }

    const lineTotal = invItem.price * item.quantity;
    orderItems.push({
      inventoryId: invItem.id,
      storeId: invItem.storeId,
      productName: invItem.productName,
      price: invItem.price,
      quantity: item.quantity,
      lineTotal: parseFloat(lineTotal.toFixed(2)),
    });
    subtotal += lineTotal;

    // Decrement inventory
    invItem.quantity -= item.quantity;
    if (invItem.quantity <= 0) invItem.inStock = false;
  }

  const deliveryFee = fulfillment === 'delivery' ? 4.99 : 0;
  const tax = parseFloat((subtotal * 0.08875).toFixed(2)); // NYC tax rate
  const total = parseFloat((subtotal + deliveryFee + tax).toFixed(2));

  const order = {
    id: uuidv4(),
    userId: req.user.id,
    items: orderItems,
    fulfillment,
    deliveryAddress: fulfillment === 'delivery' ? deliveryAddress : null,
    notes,
    subtotal: parseFloat(subtotal.toFixed(2)),
    deliveryFee,
    tax,
    total,
    status: 'pending',
    paymentStatus: 'pending', // Integration point for Stripe/Square
    statusHistory: [{ status: 'pending', timestamp: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  orders.push(order);

  // Create notification
  notifications.push({
    id: uuidv4(),
    userId: req.user.id,
    type: 'order_created',
    title: 'Order Placed',
    message: `Your order #${order.id.slice(0, 8)} has been placed. Total: $${order.total}`,
    orderId: order.id,
    read: false,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ message: 'Order created', order });
});

// GET /api/orders - List user's orders
router.get('/', authenticate, (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  let userOrders = orders.filter(o => o.userId === req.user.id);

  if (status) userOrders = userOrders.filter(o => o.status === status);

  userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = userOrders.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paginated = userOrders.slice(offset, offset + parseInt(limit));

  res.json({
    pagination: { page: parseInt(page), limit: parseInt(limit), total },
    orders: paginated
  });
});

// GET /api/orders/:id - Order details
router.get('/:id', authenticate, (req, res) => {
  const order = orders.find(o => o.id === req.params.id && o.userId === req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});

// PUT /api/orders/:id/status - Update order status (admin/store_owner)
router.put('/:id/status', authenticate, (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'picked_up', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  order.statusHistory.push({ status, timestamp: new Date().toISOString() });

  // Notify customer
  notifications.push({
    id: uuidv4(),
    userId: order.userId,
    type: 'order_status',
    title: `Order ${status.replace(/_/g, ' ')}`,
    message: `Your order #${order.id.slice(0, 8)} is now ${status.replace(/_/g, ' ')}.`,
    orderId: order.id,
    read: false,
    createdAt: new Date().toISOString(),
  });

  res.json({ message: 'Order status updated', order });
});

// POST /api/orders/:id/cancel - Cancel order
router.post('/:id/cancel', authenticate, (req, res) => {
  const order = orders.find(o => o.id === req.params.id && o.userId === req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (['delivered', 'picked_up', 'cancelled'].includes(order.status)) {
    return res.status(400).json({ error: 'Cannot cancel this order' });
  }

  order.status = 'cancelled';
  order.updatedAt = new Date().toISOString();
  order.statusHistory.push({ status: 'cancelled', timestamp: new Date().toISOString() });

  // Restore inventory
  for (const item of order.items) {
    const inv = inventory.find(i => i.id === item.inventoryId);
    if (inv) {
      inv.quantity += item.quantity;
      inv.inStock = true;
    }
  }

  res.json({ message: 'Order cancelled', order });
});

module.exports = router;
