/**
 * JWT Authentication & Authorization Middleware
 * Roles: admin, store_owner, customer
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Authenticate: Verify JWT token and attach user to req.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide Bearer token.' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Optional auth: Attach user if token present, but don't block.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], config.jwtSecret);
    } catch (e) { /* ignore invalid tokens */ }
  }
  next();
}

/**
 * Authorize: Check user role.
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
}

/**
 * Generate JWT for a user.
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiry }
  );
}

module.exports = { authenticate, optionalAuth, authorize, generateToken };
