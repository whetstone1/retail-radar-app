/**
 * Notification System Routes
 * Order updates, new products, promotions
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { notifications } = require('../models/database');

// GET /api/notifications - Get user's notifications
router.get('/', authenticate, (req, res) => {
  const { unreadOnly, type, page = 1, limit = 20 } = req.query;

  let userNotifications = notifications.filter(n => n.userId === req.user.id);

  if (unreadOnly === 'true') userNotifications = userNotifications.filter(n => !n.read);
  if (type) userNotifications = userNotifications.filter(n => n.type === type);

  userNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const unreadCount = notifications.filter(n => n.userId === req.user.id && !n.read).length;
  const total = userNotifications.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paginated = userNotifications.slice(offset, offset + parseInt(limit));

  res.json({
    unreadCount,
    pagination: { page: parseInt(page), limit: parseInt(limit), total },
    notifications: paginated
  });
});

// PUT /api/notifications/:id/read - Mark as read
router.put('/:id/read', authenticate, (req, res) => {
  const notif = notifications.find(n => n.id === req.params.id && n.userId === req.user.id);
  if (!notif) return res.status(404).json({ error: 'Notification not found' });

  notif.read = true;
  res.json({ message: 'Marked as read', notification: notif });
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', authenticate, (req, res) => {
  const count = notifications.filter(n => n.userId === req.user.id && !n.read).length;
  notifications.filter(n => n.userId === req.user.id).forEach(n => n.read = true);
  res.json({ message: `${count} notifications marked as read` });
});

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', authenticate, (req, res) => {
  const idx = notifications.findIndex(n => n.id === req.params.id && n.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Notification not found' });
  notifications.splice(idx, 1);
  res.json({ message: 'Notification deleted' });
});

module.exports = router;
