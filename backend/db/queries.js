/**
 * Retail Radar - SQL Query Layer
 * 
 * Provides direct SQL-based queries for search, geo, and analytics.
 * Eliminates dependency on in-memory arrays for complex operations.
 * Works with the sql.js SQLite engine.
 */

const sqlite = require('./sqlite');

// ============================================
// SEARCH QUERIES
// ============================================

/**
 * Full-text product search with inventory joining.
 * Returns inventory items matching search terms, with store info.
 */
function searchInventory({ query, lat, lng, radius, category, minPrice, maxPrice, retailer, inStockOnly, sortBy, sortOrder, limit, offset }) {
  const db = sqlite.db;
  if (!db) return [];

  let conditions = [];
  let params = [];

  // Text search - match against productName
  if (query && query.trim()) {
    const terms = query.toLowerCase().trim().split(/\s+/);
    for (const term of terms) {
      conditions.push(`LOWER(i.productName) LIKE ?`);
      params.push(`%${term}%`);
    }
  }

  // Category filter
  if (category) {
    conditions.push(`i.category = ?`);
    params.push(category.toLowerCase());
  }

  // Retailer filter
  if (retailer) {
    conditions.push(`i.retailer = ?`);
    params.push(retailer.toLowerCase());
  }

  // Price range
  if (minPrice !== undefined && minPrice !== null) {
    conditions.push(`i.price >= ?`);
    params.push(parseFloat(minPrice));
  }
  if (maxPrice !== undefined && maxPrice !== null) {
    conditions.push(`i.price <= ?`);
    params.push(parseFloat(maxPrice));
  }

  // In stock only
  if (inStockOnly) {
    conditions.push(`i.inStock = 1`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Build query with store join
  const sql = `
    SELECT 
      i.id, i.storeId, i.retailer, i.productSku, i.productName,
      i.price, i.originalPrice, i.quantity, i.inStock, i.category, i.brand,
      i.source, i.lastUpdated,
      s.name as storeName, s.address as storeAddress, 
      s.lat as storeLat, s.lng as storeLng,
      s.city as storeCity, s.state as storeState, s.brand as storeBrand
    FROM inventory i
    LEFT JOIN stores s ON i.storeId = s.storeId
    ${where}
    ORDER BY i.productName ASC
    LIMIT ? OFFSET ?
  `;

  params.push(limit || 100, offset || 0);

  try {
    const results = db.exec(sql, params);
    if (!results.length) return [];

    const cols = results[0].columns;
    return results[0].values.map(row => {
      const obj = {};
      cols.forEach((col, i) => {
        obj[col] = row[i];
      });
      // Convert inStock to boolean
      obj.inStock = !!obj.inStock;
      return obj;
    });
  } catch (err) {
    console.error('[Query] searchInventory error:', err.message);
    return [];
  }
}

/**
 * Count total results for a search (for pagination).
 */
function countSearchResults({ query, category, retailer, minPrice, maxPrice, inStockOnly }) {
  const db = sqlite.db;
  if (!db) return 0;

  let conditions = [];
  let params = [];

  if (query && query.trim()) {
    const terms = query.toLowerCase().trim().split(/\s+/);
    for (const term of terms) {
      conditions.push(`LOWER(productName) LIKE ?`);
      params.push(`%${term}%`);
    }
  }
  if (category) { conditions.push(`category = ?`); params.push(category.toLowerCase()); }
  if (retailer) { conditions.push(`retailer = ?`); params.push(retailer.toLowerCase()); }
  if (minPrice !== undefined) { conditions.push(`price >= ?`); params.push(parseFloat(minPrice)); }
  if (maxPrice !== undefined) { conditions.push(`price <= ?`); params.push(parseFloat(maxPrice)); }
  if (inStockOnly) { conditions.push(`inStock = 1`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const r = db.exec(`SELECT COUNT(*) FROM inventory ${where}`, params);
    return r.length ? r[0].values[0][0] : 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Find stores near a location using Haversine approximation in SQL.
 */
function findNearbyStores(lat, lng, radiusMiles = 10, retailerFilter = null) {
  const db = sqlite.db;
  if (!db) return [];

  // Approximate: 1 degree lat ≈ 69 miles
  const latRange = radiusMiles / 69;
  const lngRange = radiusMiles / (69 * Math.cos(lat * Math.PI / 180));

  let params = [lat - latRange, lat + latRange, lng - lngRange, lng + lngRange, lat, lat, lng, lng];
  let retailerClause = '';

  if (retailerFilter) {
    retailerClause = 'AND retailer = ?';
    params.push(retailerFilter);
  }

  const sql = `
    SELECT *,
      (3959 * ACOS(
        COS(? * 3.14159 / 180) * COS(lat * 3.14159 / 180) *
        COS((lng - ?) * 3.14159 / 180) +
        SIN(? * 3.14159 / 180) * SIN(lat * 3.14159 / 180)
      )) AS distance
    FROM stores
    WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
    ${retailerClause}
    ORDER BY distance ASC
  `;

  // Reorder params: acos needs lat, lng, lat first, then the BETWEEN
  const orderedParams = [lat, lng, lat, lat - latRange, lat + latRange, lng - lngRange, lng + lngRange];
  if (retailerFilter) orderedParams.push(retailerFilter);

  try {
    const results = db.exec(sql, orderedParams);
    if (!results.length) return [];

    const cols = results[0].columns;
    return results[0].values.map(row => {
      const obj = {};
      cols.forEach((col, i) => {
        let val = row[i];
        if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
          try { val = JSON.parse(val); } catch (e) {}
        }
        obj[col] = val;
      });
      return obj;
    }).filter(s => s.distance <= radiusMiles);
  } catch (err) {
    console.error('[Query] findNearbyStores error:', err.message);
    return [];
  }
}

/**
 * Get inventory for a specific store.
 */
function getStoreInventory(storeId, { category, query, limit, offset } = {}) {
  const db = sqlite.db;
  if (!db) return [];

  let conditions = ['i.storeId = ?'];
  let params = [storeId];

  if (category) { conditions.push('i.category = ?'); params.push(category); }
  if (query) {
    conditions.push('LOWER(i.productName) LIKE ?');
    params.push(`%${query.toLowerCase()}%`);
  }

  const sql = `
    SELECT i.* FROM inventory i
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.category, i.productName
    LIMIT ? OFFSET ?
  `;
  params.push(limit || 500, offset || 0);

  try {
    const results = db.exec(sql, params);
    if (!results.length) return [];
    const cols = results[0].columns;
    return results[0].values.map(row => {
      const obj = {};
      cols.forEach((col, i) => { obj[col] = row[i]; });
      obj.inStock = !!obj.inStock;
      return obj;
    });
  } catch (err) {
    return [];
  }
}

/**
 * Get aggregate stats for the platform.
 */
function getPlatformStats() {
  const db = sqlite.db;
  if (!db) return {};

  try {
    const stats = {};

    let r = db.exec('SELECT COUNT(*) FROM stores');
    stats.totalStores = r.length ? r[0].values[0][0] : 0;

    r = db.exec('SELECT COUNT(*) FROM products');
    stats.totalProducts = r.length ? r[0].values[0][0] : 0;

    r = db.exec('SELECT COUNT(*) FROM inventory WHERE inStock = 1');
    stats.totalInventory = r.length ? r[0].values[0][0] : 0;

    r = db.exec('SELECT COUNT(DISTINCT retailer) FROM stores');
    stats.totalRetailers = r.length ? r[0].values[0][0] : 0;

    r = db.exec('SELECT COUNT(DISTINCT city) FROM stores');
    stats.totalCities = r.length ? r[0].values[0][0] : 0;

    r = db.exec('SELECT COUNT(DISTINCT state) FROM stores');
    stats.totalStates = r.length ? r[0].values[0][0] : 0;

    r = db.exec('SELECT COUNT(DISTINCT category) FROM inventory');
    stats.totalCategories = r.length ? r[0].values[0][0] : 0;

    r = db.exec('SELECT COUNT(*) FROM users');
    stats.totalUsers = r.length ? r[0].values[0][0] : 0;

    r = db.exec('SELECT COUNT(*) FROM orders');
    stats.totalOrders = r.length ? r[0].values[0][0] : 0;

    // Top retailers by store count
    r = db.exec('SELECT retailer, brand, COUNT(*) as cnt FROM stores GROUP BY retailer ORDER BY cnt DESC LIMIT 15');
    if (r.length) {
      stats.retailerBreakdown = r[0].values.map(row => ({
        retailer: row[0], brand: row[1], stores: row[2]
      }));
    }

    // Top categories by inventory count
    r = db.exec('SELECT category, COUNT(*) as cnt FROM inventory WHERE inStock = 1 GROUP BY category ORDER BY cnt DESC');
    if (r.length) {
      stats.categoryBreakdown = r[0].values.map(row => ({
        category: row[0], items: row[1]
      }));
    }

    // Cities covered
    r = db.exec('SELECT city, state, COUNT(*) as cnt FROM stores GROUP BY city, state ORDER BY cnt DESC');
    if (r.length) {
      stats.cityCoverage = r[0].values.map(row => ({
        city: row[0], state: row[1], stores: row[2]
      }));
    }

    return stats;
  } catch (err) {
    console.error('[Query] getPlatformStats error:', err.message);
    return {};
  }
}

/**
 * Get distinct categories with item counts.
 */
function getCategories() {
  const db = sqlite.db;
  if (!db) return [];

  try {
    const r = db.exec('SELECT category, COUNT(*) as cnt FROM inventory WHERE inStock = 1 GROUP BY category ORDER BY cnt DESC');
    if (!r.length) return [];
    return r[0].values.map(row => ({ name: row[0], count: row[1] }));
  } catch (err) {
    return [];
  }
}

/**
 * Search suggestions / autocomplete.
 */
function getSuggestions(prefix, limit = 8) {
  const db = sqlite.db;
  if (!db || !prefix) return [];

  try {
    const r = db.exec(
      `SELECT DISTINCT productName FROM inventory 
       WHERE LOWER(productName) LIKE ? AND inStock = 1
       LIMIT ?`,
      [`%${prefix.toLowerCase()}%`, limit]
    );
    if (!r.length) return [];
    return r[0].values.map(row => row[0]);
  } catch (err) {
    return [];
  }
}

/**
 * Get price comparison for a product across stores.
 */
function getPriceComparison(productName, lat, lng, radiusMiles = 15) {
  const db = sqlite.db;
  if (!db) return [];

  try {
    const results = searchInventory({
      query: productName,
      lat, lng,
      radius: radiusMiles,
      inStockOnly: true,
      limit: 50,
      offset: 0,
    });

    // Sort by price
    return results.sort((a, b) => a.price - b.price);
  } catch (err) {
    return [];
  }
}

module.exports = {
  searchInventory,
  countSearchResults,
  findNearbyStores,
  getStoreInventory,
  getPlatformStats,
  getCategories,
  getSuggestions,
  getPriceComparison,
};
