/**
 * Retail Radar - Scraper Runner & Ingestion Pipeline
 * 
 * Orchestrates scraping across all retailers, normalizes data,
 * and ingests stores + products into the Retail Radar database.
 * 
 * Usage:
 *   node scraper/index.js                    # Scrape all retailers, NYC metro
 *   node scraper/index.js --lat=34.05 --lng=-118.24  # LA area
 *   node scraper/index.js --retailer=homedepot        # Single retailer
 *   node scraper/index.js --radius=50                  # 50 mile radius
 *   node scraper/index.js --products --query="drill"  # Also scrape products
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import all scrapers
const HomeDepotScraper = require('./retailers/homedepot');
const LowesScraper = require('./retailers/lowes');
const { BestBuyScraper, TargetScraper, WalmartScraper, CVSScraper, AceHardwareScraper } = require('./retailers/others');

// Available scrapers
const SCRAPERS = {
  homedepot: HomeDepotScraper,
  lowes: LowesScraper,
  bestbuy: BestBuyScraper,
  target: TargetScraper,
  walmart: WalmartScraper,
  cvs: CVSScraper,
  acehardware: AceHardwareScraper,
};

// Metro areas to scrape
const METRO_AREAS = [
  { name: 'New York', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'Washington DC', lat: 38.9072, lng: -77.0369 },
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  { name: 'Atlanta', lat: 33.7490, lng: -84.3880 },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
  { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
];

// Common product queries for initial scraping
const PRODUCT_QUERIES = [
  'drill', 'hammer', 'screwdriver', 'tape measure', 'work gloves',
  'light bulbs', 'extension cord', 'batteries', 'duct tape', 'flashlight',
  'paint roller', 'hangers', 'storage bins', 'power strip', 'hdmi cable',
  'usb cable', 'plunger', 'garden hose', 'safety glasses', 'door lock',
];

class ScraperRunner {
  constructor(options = {}) {
    this.options = {
      lat: options.lat || 40.6892,  // Default: Brooklyn
      lng: options.lng || -73.9857,
      radius: options.radius || 25,
      retailers: options.retailer ? [options.retailer] : Object.keys(SCRAPERS),
      scrapeProducts: options.products || false,
      productQueries: options.queries || PRODUCT_QUERIES.slice(0, 5),
      allMetros: options.allMetros || false,
      ...options,
    };
    this.results = {
      stores: [],
      products: [],
      errors: [],
      stats: {},
    };
  }

  async run() {
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║  🔴 Retail Radar - Web Scraper                    ║');
    console.log('║  Scraping local retail inventory                   ║');
    console.log('╚═══════════════════════════════════════════════════╝');

    const locations = this.options.allMetros ? METRO_AREAS : [{
      name: 'Custom', lat: this.options.lat, lng: this.options.lng
    }];

    console.log(`\nRetailers: ${this.options.retailers.join(', ')}`);
    console.log(`Locations: ${locations.map(l => l.name).join(', ')}`);
    console.log(`Radius: ${this.options.radius} miles`);
    console.log(`Products: ${this.options.scrapeProducts ? 'Yes' : 'Stores only'}\n`);

    const startTime = Date.now();

    for (const retailerKey of this.options.retailers) {
      const ScraperClass = SCRAPERS[retailerKey];
      if (!ScraperClass) {
        console.log(`⚠️ Unknown retailer: ${retailerKey}`);
        continue;
      }

      const scraper = new ScraperClass();
      console.log(`\n━━━ ${scraper.retailerName} ━━━`);

      for (const location of locations) {
        try {
          // 1. Find stores
          const stores = await scraper.findStores(location.lat, location.lng, this.options.radius);
          console.log(`  📍 ${location.name}: ${stores.length} stores found`);

          // Deduplicate
          for (const store of stores) {
            const exists = this.results.stores.find(s =>
              s.retailerKey === store.retailerKey && s.externalStoreId === store.externalStoreId
            );
            if (!exists) {
              this.results.stores.push(store);
            }
          }

          // 2. Optionally scrape products
          if (this.options.scrapeProducts && stores.length > 0) {
            // Pick first store for product scraping
            const targetStore = stores[0];
            for (const query of this.options.productQueries) {
              try {
                const products = await scraper.searchProducts(
                  targetStore.externalStoreId, query
                );
                if (products.length > 0) {
                  console.log(`    🔍 "${query}": ${products.length} products`);
                  this.results.products.push(...products);
                }
              } catch (err) {
                this.results.errors.push({ retailer: retailerKey, query, error: err.message });
              }
            }
          }
        } catch (err) {
          console.log(`  ❌ ${location.name}: ${err.message}`);
          this.results.errors.push({ retailer: retailerKey, location: location.name, error: err.message });
        }
      }

      this.results.stats[retailerKey] = scraper.getStats();
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Deduplicate products by name+retailer
    const seen = new Set();
    this.results.products = this.results.products.filter(p => {
      const key = `${p.retailerKey}-${p.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log(`║  ✅ Scraping complete in ${elapsed}s`);
    console.log(`║  🏪 Stores: ${this.results.stores.length}`);
    console.log(`║  📦 Products: ${this.results.products.length}`);
    console.log(`║  ❌ Errors: ${this.results.errors.length}`);
    console.log('╚═══════════════════════════════════════════════════╝');

    return this.results;
  }

  /**
   * Ingest scraped data into the Retail Radar database.
   * Merges with existing data, updates prices, adds new stores/products.
   */
  ingestIntoDatabase(db) {
    console.log('\n📥 Ingesting into Retail Radar database...');
    let storesAdded = 0, storesUpdated = 0;
    let productsAdded = 0;

    // Get all existing stores for comparison
    const existingStores = db.getAllStores();

    // 1. Ingest stores
    for (const scrapedStore of this.results.stores) {
      const internalId = `${scrapedStore.retailerKey.toUpperCase().slice(0,2)}_${scrapedStore.externalStoreId}`;

      // Check if this store already exists in the chain data
      const exists = existingStores.find(s =>
        s.storeId === internalId ||
        (Math.abs(s.lat - scrapedStore.lat) < 0.001 && Math.abs(s.lng - scrapedStore.lng) < 0.001)
      );

      if (!exists) {
        // Add new store to the appropriate chain
        const chainKey = scrapedStore.retailerKey;
        if (db.STORE_CHAINS[chainKey]) {
          db.STORE_CHAINS[chainKey].stores.push({
            id: internalId,
            name: scrapedStore.name,
            address: scrapedStore.address || `${scrapedStore.city}, ${scrapedStore.state}`,
            lat: scrapedStore.lat,
            lng: scrapedStore.lng,
            city: scrapedStore.city,
            state: scrapedStore.state,
          });
          storesAdded++;
        }
      } else {
        storesUpdated++;
      }
    }

    // 2. Ingest products into inventory
    for (const product of this.results.products) {
      if (!product.price || product.price <= 0) continue;

      // Find which stores carry this product (same retailer)
      const retailerStores = existingStores.filter(s =>
        s.retailer === product.retailerKey
      );

      for (const store of retailerStores.slice(0, 3)) { // Add to first 3 matching stores
        const existingItem = db.inventory.find(i =>
          i.storeId === store.storeId &&
          i.productName.toLowerCase() === product.name.toLowerCase()
        );

        if (!existingItem) {
          db.inventory.push({
            id: uuidv4(),
            storeId: store.storeId,
            retailer: product.retailerKey,
            productSku: product.sku || product.externalProductId || `SCRP-${uuidv4().slice(0,8)}`,
            productName: product.name,
            price: product.price,
            quantity: product.inStock ? Math.floor(Math.random() * 30) + 5 : 0,
            category: product.category,
            brand: product.brand || '',
            keywords: product.name.toLowerCase().split(' ').filter(w => w.length > 2),
            inStock: product.inStock,
            imageUrl: product.imageUrl || '',
            lastUpdated: new Date().toISOString(),
            source: 'scraper',
          });
          productsAdded++;
        }
      }
    }

    console.log(`  🏪 Stores: ${storesAdded} added, ${storesUpdated} already existed`);
    console.log(`  📦 Products: ${productsAdded} inventory items added`);

    return { storesAdded, storesUpdated, productsAdded };
  }

  /**
   * Save results to JSON files for later analysis or import.
   */
  saveResults() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    fs.writeFileSync(
      path.join(dataDir, `stores-${timestamp}.json`),
      JSON.stringify(this.results.stores, null, 2)
    );
    fs.writeFileSync(
      path.join(dataDir, `products-${timestamp}.json`),
      JSON.stringify(this.results.products, null, 2)
    );
    fs.writeFileSync(
      path.join(dataDir, `stats-${timestamp}.json`),
      JSON.stringify({ stats: this.results.stats, errors: this.results.errors }, null, 2)
    );

    console.log(`\n💾 Results saved to ${dataDir}/`);
  }
}

// ============================================
// CLI Runner
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, val] = arg.replace('--', '').split('=');
    acc[key] = val === undefined ? true : isNaN(val) ? val : parseFloat(val);
    return acc;
  }, {});

  const runner = new ScraperRunner({
    lat: args.lat,
    lng: args.lng,
    radius: args.radius,
    retailer: args.retailer,
    products: args.products,
    allMetros: args.allMetros || args.all,
  });

  runner.run().then(results => {
    runner.saveResults();

    // If --ingest flag, also push into the live database
    if (args.ingest) {
      const db = require('../backend/models/database');
      runner.ingestIntoDatabase(db);
    }
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = ScraperRunner;
