/**
 * Auth Routes: Register, Login, Profile, Update
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { authenticate, generateToken } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validation');
const { users, persist } = require('../models/database');
const config = require('../config');

// POST /api/auth/register
router.post('/register', rules.register, validate, async (req, res) => {
  try {
    const { email, password, name, role = 'customer' } = req.body;

    if (users.find(u => u.email === email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);
    const user = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      name,
      role,
      favorites: [],
      savedStores: [],
      createdAt: new Date().toISOString()
    };

    users.push(user);
    persist.user(user);
    const token = generateToken(user);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error('[AUTH] Registration error:', err.message, err.stack);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', rules.login, validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/profile
router.get('/profile', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { password, ...safeUser } = user;
  res.json({ user: safeUser });
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, email } = req.body;
  if (name) user.name = name;
  if (email && email !== user.email) {
    if (users.find(u => u.email === email && u.id !== user.id)) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    user.email = email;
  }

  const { password, ...safeUser } = user;
  persist.user(user);
  res.json({ message: 'Profile updated', user: safeUser });
});

// POST /api/auth/favorites
router.post('/favorites', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { productSku } = req.body;
  if (!productSku) return res.status(400).json({ error: 'productSku required' });

  if (!user.favorites.includes(productSku)) {
    user.favorites.push(productSku);
  }
  persist.user(user);
  res.json({ message: 'Favorite added', favorites: user.favorites });
});

// DELETE /api/auth/favorites/:sku
router.delete('/favorites/:sku', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.favorites = user.favorites.filter(f => f !== req.params.sku);
  persist.user(user);
  res.json({ message: 'Favorite removed', favorites: user.favorites });
});

module.exports = router;
