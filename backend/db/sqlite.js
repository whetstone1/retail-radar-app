/**
 * SQLite Persistence Layer for Retail Radar
 * 
 * Uses sql.js (pure JS SQLite) for zero-config persistence.
 * Data is loaded into memory on startup and written through on mutations.
 * DB file: ./data/retail-radar.db
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.VERCEL
  ? '/tmp/retail-radar.db'
  : path.join(__dirname, '..', 'data', 'retail-radar.db');
let sqlDb = null;
let initialized = false;

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  if (initialized) return;
  
  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
    console.log('[DB] Loaded existing database from', DB_PATH);
  } else {
    sqlDb = new SQL.Database();
    console.log('[DB] Created new database');
  }

  createTables();
  initialized = true;
  return sqlDb;
}

function createTables() {
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'customer',
      stripeCustomerId TEXT,
      favorites TEXT DEFAULT '[]',
      savedStores TEXT DEFAULT '[]',
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS stores (
      storeId TEXT PRIMARY KEY,
      retailer TEXT NOT NULL,
      brand TEXT,
      name TEXT NOT NULL,
      address TEXT,
      lat REAL,
      lng REAL,
      city TEXT,
      state TEXT,
      phone TEXT,
      hours TEXT,
      categories TEXT DEFAULT '[]',
      source TEXT DEFAULT 'seed',
      scrapedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL,
      category TEXT,
      keywords TEXT DEFAULT '[]',
      retailers TEXT DEFAULT '[]',
      image TEXT,
      description TEXT,
      brand TEXT,
      upc TEXT,
      source TEXT DEFAULT 'seed'
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      storeId TEXT NOT NULL,
      retailer TEXT,
      productSku TEXT,
      productName TEXT NOT NULL,
      price REAL NOT NULL,
      originalPrice REAL,
      quantity INTEGER DEFAULT 0,
      inStock INTEGER DEFAULT 1,
      category TEXT,
      brand TEXT,
      keywords TEXT DEFAULT '[]',
      source TEXT DEFAULT 'seed',
      addedBy TEXT,
      lastUpdated TEXT,
      FOREIGN KEY (storeId) REFERENCES stores(storeId)
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      items TEXT DEFAULT '[]',
      subtotal REAL,
      fees TEXT DEFAULT '{}',
      total REAL,
      fulfillment TEXT,
      deliveryAddress TEXT,
      status TEXT DEFAULT 'pending',
      storeId TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT,
      title TEXT,
      message TEXT,
      read INTEGER DEFAULT 0,
      createdAt TEXT
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      storeId TEXT NOT NULL,
      userId TEXT,
      planId TEXT,
      inventoryPlanId TEXT,
      status TEXT DEFAULT 'active',
      stripeSubscriptionId TEXT,
      stripeCustomerId TEXT,
      monthlyTotal REAL,
      commission REAL,
      currentPeriodEnd TEXT,
      cancelsAt TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS consumer_subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      planId TEXT,
      billingInterval TEXT DEFAULT 'monthly',
      price REAL,
      status TEXT DEFAULT 'active',
      stripeSubscriptionId TEXT,
      stripeCustomerId TEXT,
      trialEnd TEXT,
      currentPeriodEnd TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS promotions (
      id TEXT PRIMARY KEY,
      storeId TEXT NOT NULL,
      productSkus TEXT DEFAULT '[]',
      placement TEXT,
      dailyBudget REAL,
      totalSpent REAL DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      cpc REAL,
      status TEXT DEFAULT 'active',
      startDate TEXT,
      endDate TEXT,
      createdAt TEXT
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS store_claims (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      storeId TEXT NOT NULL,
      claimedAt TEXT,
      UNIQUE(userId, storeId)
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS scraper_jobs (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'pending',
      retailers TEXT,
      storesFound INTEGER DEFAULT 0,
      productsFound INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      startedAt TEXT,
      completedAt TEXT
    )
  `);

  // Indexes
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory(storeId)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(productName)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_stores_city ON stores(city)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_stores_retailer ON stores(retailer)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(userId)');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
}

// ============================================
// PERSISTENCE HELPERS (write-through)
// ============================================

function saveToDisk() {
  if (!sqlDb) return;
  const data = sqlDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Auto-save every 10 seconds
let saveTimer = null;
function startAutoSave() {
  if (saveTimer) return;
  saveTimer = setInterval(() => {
    if (initialized) saveToDisk();
  }, 10000);
  // Also save on process exit
  process.on('SIGINT', () => { saveToDisk(); process.exit(); });
  process.on('SIGTERM', () => { saveToDisk(); process.exit(); });
}

// ============================================
// GENERIC CRUD
// ============================================

function upsert(table, obj, primaryKey = 'id') {
  if (!sqlDb) return;
  const keys = Object.keys(obj);
  const vals = keys.map(k => {
    const v = obj[k];
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') return JSON.stringify(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  });
  const placeholders = keys.map(() => '?').join(',');
  const updates = keys.filter(k => k !== primaryKey).map(k => `${k}=excluded.${k}`).join(',');
  
  sqlDb.run(
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})
     ON CONFLICT(${primaryKey}) DO UPDATE SET ${updates}`,
    vals
  );
}

function deleteRow(table, primaryKey, value) {
  if (!sqlDb) return;
  sqlDb.run(`DELETE FROM ${table} WHERE ${primaryKey} = ?`, [value]);
}

function loadTable(table) {
  if (!sqlDb) return [];
  const results = sqlDb.exec(`SELECT * FROM ${table}`);
  if (!results.length) return [];
  const cols = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => {
      let val = row[i];
      // Try to parse JSON strings
      if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
        try { val = JSON.parse(val); } catch (e) {}
      }
      // Convert integer booleans back
      if (col === 'inStock' || col === 'read') val = !!val;
      obj[col] = val;
    });
    return obj;
  });
}

function getRowCount(table) {
  if (!sqlDb) return 0;
  const r = sqlDb.exec(`SELECT COUNT(*) FROM ${table}`);
  return r.length ? r[0].values[0][0] : 0;
}

// ============================================
// TABLE-SPECIFIC SAVE FUNCTIONS
// ============================================

const save = {
  user(u) { upsert('users', { ...u, favorites: JSON.stringify(u.favorites || []) }); },
  store(s) { upsert('stores', { ...s, categories: JSON.stringify(s.categories || []) }, 'storeId'); },
  product(p) { upsert('products', { ...p, keywords: JSON.stringify(p.keywords || []), retailers: JSON.stringify(p.retailers || []) }, 'sku'); },
  inventory(i) { upsert('inventory', { ...i, inStock: i.inStock ? 1 : 0 }); },
  order(o) { upsert('orders', { ...o, items: JSON.stringify(o.items || []), fees: JSON.stringify(o.fees || {}) }); },
  notification(n) { upsert('notifications', { ...n, read: n.read ? 1 : 0 }); },
  subscription(s) { upsert('subscriptions', s); },
  consumerSubscription(s) { upsert('consumer_subscriptions', s); },
  promotion(p) { upsert('promotions', { ...p, productSkus: JSON.stringify(p.productSkus || []) }); },
  storeClaim(c) { upsert('store_claims', c); },
  scraperJob(j) { upsert('scraper_jobs', j); },
};

const remove = {
  inventory(id) { deleteRow('inventory', 'id', id); },
  notification(id) { deleteRow('notifications', 'id', id); },
  order(id) { deleteRow('orders', 'id', id); },
  storeClaim(id) { deleteRow('store_claims', 'id', id); },
};

// ============================================
// LOAD ALL DATA INTO MEMORY
// ============================================

function loadAll() {
  return {
    users: loadTable('users'),
    stores: loadTable('stores'),
    products: loadTable('products'),
    inventory: loadTable('inventory'),
    orders: loadTable('orders'),
    notifications: loadTable('notifications'),
    subscriptions: loadTable('subscriptions'),
    consumerSubscriptions: loadTable('consumer_subscriptions'),
    promotions: loadTable('promotions'),
    storeClaims: loadTable('store_claims'),
    scraperJobs: loadTable('scraper_jobs'),
  };
}

// ============================================
// BULK OPERATIONS (for seeding/scraping)
// ============================================

function bulkInsertInventory(items) {
  if (!sqlDb || !items.length) return;
  const stmt = sqlDb.prepare(
    `INSERT OR REPLACE INTO inventory (id, storeId, retailer, productSku, productName, price, originalPrice, quantity, inStock, category, brand, source, lastUpdated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const i of items) {
    stmt.run([i.id, i.storeId, i.retailer, i.productSku, i.productName, i.price, i.originalPrice || null, i.quantity || 0, i.inStock ? 1 : 0, i.category || null, i.brand || null, i.source || 'seed', i.lastUpdated || new Date().toISOString()]);
  }
  stmt.free();
}

function bulkInsertStores(stores) {
  if (!sqlDb || !stores.length) return;
  const stmt = sqlDb.prepare(
    `INSERT OR IGNORE INTO stores (storeId, retailer, brand, name, address, lat, lng, city, state, phone, hours, categories, source, scrapedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const s of stores) {
    stmt.run([s.storeId, s.retailer, s.brand, s.name, s.address, s.lat, s.lng, s.city, s.state, s.phone || null, s.hours || null, JSON.stringify(s.categories || []), s.source || 'seed', s.scrapedAt || null]);
  }
  stmt.free();
}

function bulkInsertProducts(products) {
  if (!sqlDb || !products.length) return;
  const stmt = sqlDb.prepare(
    `INSERT OR REPLACE INTO products (sku, name, price, category, keywords, retailers, image, description, brand, upc, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const p of products) {
    stmt.run([p.sku, p.name, p.price, p.category, JSON.stringify(p.keywords || []), JSON.stringify(p.retailers || []), p.image || null, p.description || null, p.brand || null, p.upc || null, p.source || 'seed']);
  }
  stmt.free();
}

// ============================================
// STATS
// ============================================

function getStats() {
  return {
    users: getRowCount('users'),
    stores: getRowCount('stores'),
    products: getRowCount('products'),
    inventory: getRowCount('inventory'),
    orders: getRowCount('orders'),
    subscriptions: getRowCount('subscriptions'),
  };
}

module.exports = {
  init,
  saveToDisk,
  startAutoSave,
  save,
  remove,
  loadAll,
  loadTable,
  getStats,
  bulkInsertInventory,
  bulkInsertStores,
  bulkInsertProducts,
  getRowCount,
  get db() { return sqlDb; },
  get initialized() { return initialized; },
  DB_PATH,
};
