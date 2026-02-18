/**
 * Data Validation & Error Handling Middleware
 */

const { validationResult, body, query, param } = require('express-validator');

// ============================================
// Validation result handler
// ============================================
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

// ============================================
// Validation Rules
// ============================================
const rules = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required'),
    body('role').optional().isIn(['customer', 'store_owner']).withMessage('Role must be customer or store_owner'),
  ],
  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  search: [
    body('query').optional({ values: 'falsy' }).trim().isLength({ max: 200 }).withMessage('Search query too long'),
    body('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('radius').optional().isFloat({ min: 0.1, max: 50 }).withMessage('Radius must be 0.1-50 miles'),
    body('category').optional().trim(),
    body('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be >= 0'),
    body('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be >= 0'),
    body('sortBy').optional().isIn(['price', 'distance', 'name', 'relevance']).withMessage('Invalid sort'),
    body('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
    body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  ],
  inventoryItem: [
    body('productName').trim().isLength({ min: 1, max: 200 }).withMessage('Product name required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be >= 0'),
    body('category').optional().trim(),
    body('keywords').optional().isArray(),
  ],
  order: [
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.inventoryId').notEmpty().withMessage('Inventory ID required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be >= 1'),
    body('fulfillment').isIn(['pickup', 'delivery']).withMessage('Fulfillment must be pickup or delivery'),
    body('deliveryAddress').optional().isObject(),
  ],
  storeId: [
    param('storeId').notEmpty().withMessage('Store ID required'),
  ],
};

// ============================================
// Global error handler
// ============================================
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.path}:`, err.message);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

// ============================================
// Request logger (structured)
// ============================================
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`[${req.method}] ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
}

module.exports = { validate, rules, errorHandler, requestLogger };
