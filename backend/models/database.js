/**
 * Retail Radar - Persistent Database v5.0
 * 
 * SQLite-backed with expanded catalog:
 * - 500+ products across 20+ categories
 * - 15 retailers with 300+ store locations
 * - 22 metro areas nationwide
 * - ~50,000+ inventory records
 * 
 * Data survives server restarts via write-through to SQLite.
 */

const { v4: uuidv4 } = require('uuid');
const sqlite = require('../db/sqlite');
const catalog = require('../data/catalog');

// In-memory arrays (fast reads, synced with SQLite)
const users = [];
const inventory = [];
const orders = [];
const notifications = [];
const subscriptions = [];
const consumerSubscriptions = [];
const promotions = [];
const storeClaims = [];

// ============================================
// STORE CHAINS (from catalog)
// ============================================
const STORE_CHAINS = {};
const _allStores = [];

function buildStoreChains() {
  const generatedStores = catalog.generateStores();

  for (const [key, retailer] of Object.entries(catalog.RETAILERS)) {
    STORE_CHAINS[key] = {
      brand: retailer.brand,
      categories: retailer.categories,
      stores: generatedStores
        .filter(s => s.retailer === key)
        .map(s => ({
          storeId: s.storeId,
          name: s.name,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          city: s.city,
          state: s.state,
          phone: s.phone,
          hours: s.hours,
        })),
    };
  }

  _allStores.length = 0;
  for (const store of generatedStores) {
    _allStores.push(store);
  }
}

// ============================================
// PRODUCT CATALOG (500+ items from catalog)
// ============================================
const PRODUCTS = catalog.PRODUCTS;

// ============================================
// INIT: Load from SQLite or seed
// ============================================
let _initialized = false;

async function init() {
  if (_initialized) return;
  await sqlite.init();
  buildStoreChains();

  const storeCount = sqlite.getRowCount('stores');
  const invCount = sqlite.getRowCount('inventory');
  const productCount = sqlite.getRowCount('products');

  if (storeCount < _allStores.length * 0.9) {
    console.log('[DB] Seeding ' + _allStores.length + ' stores from expanded catalog...');
    sqlite.bulkInsertStores(_allStores);
    console.log('[DB] Seeded ' + _allStores.length + ' stores across ' + catalog.CITIES.length + ' cities');
  } else {
    console.log('[DB] Found ' + storeCount + ' existing stores');
  }

  if (productCount < PRODUCTS.length * 0.9) {
    console.log('[DB] Seeding ' + PRODUCTS.length + ' products from expanded catalog...');
    sqlite.bulkInsertProducts(PRODUCTS);
    console.log('[DB] Seeded ' + PRODUCTS.length + ' products');
  } else {
    console.log('[DB] Found ' + productCount + ' existing products');
  }

  const expectedInv = estimateInventorySize();
  if (invCount < expectedInv * 0.5) {
    console.log('[DB] Seeding inventory (products x stores)...');
    const startTime = Date.now();
    seedInventory();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('[DB] Seeded ' + inventory.length + ' inventory items in ' + elapsed + 's');
    sqlite.bulkInsertInventory(inventory);
  } else {
    console.log('[DB] Found ' + invCount + ' existing inventory items');
    const loaded = sqlite.loadAll();
    inventory.push(...loaded.inventory);
  }

  const data = sqlite.loadAll();
  users.push(...data.users);
  orders.push(...data.orders);
  notifications.push(...data.notifications);
  subscriptions.push(...data.subscriptions);
  consumerSubscriptions.push(...data.consumerSubscriptions);
  promotions.push(...data.promotions);
  storeClaims.push(...(data.storeClaims || []));

  sqlite.startAutoSave();
  _initialized = true;

  const stats = sqlite.getStats();
  console.log('[DB] Ready: ' + stats.stores + ' stores, ' + stats.products + ' products, ' + stats.inventory + ' inventory, ' + stats.users + ' users');
}

function estimateInventorySize() {
  let count = 0;
  for (const product of PRODUCTS) {
    for (const retailerKey of product.retailers) {
      const chain = STORE_CHAINS[retailerKey];
      if (chain) count += chain.stores.length;
    }
  }
  return Math.floor(count * 0.85);
}

function seedInventory() {
  inventory.length = 0;
  let inStockCount = 0;

  for (const product of PRODUCTS) {
    for (const retailerKey of product.retailers) {
      const chain = STORE_CHAINS[retailerKey];
      if (!chain) continue;

      for (const store of chain.stores) {
        const hash = Math.abs(deterministicHash(product.sku + store.storeId));
        const inStock = hash % 100 > 12;

        if (inStock) {
          const retailerMod = catalog.RETAILERS[retailerKey]?.priceModifier || 1.0;
          const spread = 1 + ((hash % 16) - 8) / 100;
          const price = parseFloat((product.price * retailerMod * spread).toFixed(2));

          inventory.push({
            id: uuidv4(),
            storeId: store.storeId,
            retailer: retailerKey,
            productSku: product.sku,
            productName: product.name,
            price,
            originalPrice: product.price,
            quantity: (hash % 80) + 2,
            inStock: true,
            category: product.category,
            brand: product.brand || null,
            source: 'seed',
            lastUpdated: new Date().toISOString(),
          });
          inStockCount++;
        }
      }
    }
  }
}

function deterministicHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return hash;
}

const persist = {
  user(u) { sqlite.save.user(u); sqlite.saveToDisk(); },
  inventory(i) { sqlite.save.inventory(i); },
  order(o) { sqlite.save.order(o); sqlite.saveToDisk(); },
  notification(n) { sqlite.save.notification(n); },
  subscription(s) { sqlite.save.subscription(s); sqlite.saveToDisk(); },
  consumerSubscription(s) { sqlite.save.consumerSubscription(s); sqlite.saveToDisk(); },
  promotion(p) { sqlite.save.promotion(p); },
  storeClaim(c) { sqlite.save.storeClaim(c); sqlite.saveToDisk(); },
  removeInventory(id) { sqlite.remove.inventory(id); },
  flush() { sqlite.saveToDisk(); },
  bulkInventory(items) { sqlite.bulkInsertInventory(items); sqlite.saveToDisk(); },
  bulkStores(stores) { sqlite.bulkInsertStores(stores); sqlite.saveToDisk(); },
};

function getAllStores() {
  return _allStores;
}

module.exports = {
  init, users, STORE_CHAINS, PRODUCTS, inventory, orders, notifications,
  subscriptions, consumerSubscriptions, promotions, storeClaims,
  getAllStores, seedInventory, persist, sqlite,
};
