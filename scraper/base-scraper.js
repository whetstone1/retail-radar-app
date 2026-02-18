/**
 * Base Scraper - Common functionality for all retailer scrapers
 * 
 * Handles: HTTP requests with retry, rate limiting, data normalization,
 * error logging, and output formatting for the Retail Radar database.
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

class BaseScraper {
  constructor(retailerKey, config = {}) {
    this.retailerKey = retailerKey;
    this.retailerName = config.name || retailerKey;
    this.baseUrl = config.baseUrl || '';
    this.rateLimit = config.rateLimit || 1000; // ms between requests
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 15000;
    this.lastRequestTime = 0;
    this.stats = { requests: 0, errors: 0, storesFound: 0, productsFound: 0 };
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];
  }

  // Rate-limited fetch with retry
  async fetchWithRetry(url, options = {}, retries = 0) {
    // Enforce rate limit
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimit) {
      await this.sleep(this.rateLimit - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();

    const defaultHeaders = {
      'User-Agent': this.userAgents[Math.floor(Math.random() * this.userAgents.length)],
      'Accept': 'application/json, text/html, */*',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    const fetchOptions = {
      headers: { ...defaultHeaders, ...options.headers },
      timeout: this.timeout,
      ...options,
    };

    try {
      this.stats.requests++;
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        if (response.status === 429 && retries < this.maxRetries) {
          const backoff = Math.pow(2, retries) * 2000;
          this.log(`Rate limited. Retrying in ${backoff}ms...`);
          await this.sleep(backoff);
          return this.fetchWithRetry(url, options, retries + 1);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        return await response.json();
      }
      return await response.text();
    } catch (err) {
      this.stats.errors++;
      if (retries < this.maxRetries && (err.type === 'request-timeout' || err.code === 'ECONNRESET')) {
        this.log(`Request failed (${err.message}). Retry ${retries + 1}/${this.maxRetries}...`);
        await this.sleep(Math.pow(2, retries) * 1000);
        return this.fetchWithRetry(url, options, retries + 1);
      }
      throw err;
    }
  }

  // ===== METHODS TO OVERRIDE PER RETAILER =====

  /**
   * Find stores near a location. Override in subclass.
   * @param {number} lat 
   * @param {number} lng 
   * @param {number} radiusMiles 
   * @returns {Promise<Array<StoreLocation>>}
   */
  async findStores(lat, lng, radiusMiles = 25) {
    throw new Error('findStores() must be implemented by retailer scraper');
  }

  /**
   * Search products at a specific store. Override in subclass.
   * @param {string} storeId - Retailer's store ID
   * @param {string} query - Search term
   * @param {number} page
   * @returns {Promise<Array<Product>>}
   */
  async searchProducts(storeId, query, page = 1) {
    throw new Error('searchProducts() must be implemented by retailer scraper');
  }

  /**
   * Get product details & inventory for a specific store. Override in subclass.
   * @param {string} storeId 
   * @param {string} productId 
   * @returns {Promise<ProductDetail>}
   */
  async getProductDetail(storeId, productId) {
    throw new Error('getProductDetail() must be implemented by retailer scraper');
  }

  // ===== NORMALIZATION =====

  normalizeStore(rawStore) {
    return {
      retailerKey: this.retailerKey,
      retailerName: this.retailerName,
      externalStoreId: String(rawStore.storeId || rawStore.id || ''),
      name: rawStore.name || `${this.retailerName} Store`,
      address: rawStore.address || '',
      city: rawStore.city || '',
      state: rawStore.state || '',
      zip: rawStore.zip || '',
      lat: parseFloat(rawStore.lat) || 0,
      lng: parseFloat(rawStore.lng) || 0,
      phone: rawStore.phone || '',
      hours: rawStore.hours || null,
      scrapedAt: new Date().toISOString(),
    };
  }

  normalizeProduct(rawProduct, storeId) {
    const price = this.parsePrice(rawProduct.price);
    return {
      retailerKey: this.retailerKey,
      retailerName: this.retailerName,
      storeId: storeId,
      externalProductId: String(rawProduct.productId || rawProduct.sku || rawProduct.id || ''),
      sku: rawProduct.sku || rawProduct.modelNumber || '',
      name: this.cleanText(rawProduct.name || rawProduct.title || ''),
      description: this.cleanText(rawProduct.description || ''),
      category: this.normalizeCategory(rawProduct.category || rawProduct.department || ''),
      brand: rawProduct.brand || '',
      price: price,
      originalPrice: this.parsePrice(rawProduct.originalPrice || rawProduct.wasPrice) || price,
      imageUrl: rawProduct.imageUrl || rawProduct.image || '',
      productUrl: rawProduct.url || rawProduct.productUrl || '',
      inStock: rawProduct.inStock !== undefined ? Boolean(rawProduct.inStock) : true,
      quantity: rawProduct.quantity || (rawProduct.inStock ? 10 : 0),
      rating: parseFloat(rawProduct.rating) || null,
      reviewCount: parseInt(rawProduct.reviewCount) || 0,
      scrapedAt: new Date().toISOString(),
    };
  }

  // ===== UTILITIES =====

  parsePrice(val) {
    if (!val) return null;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').replace(/<[^>]*>/g, '').trim();
  }

  normalizeCategory(raw) {
    const mapping = {
      'tools': 'hardware', 'hand tools': 'hardware', 'power tools': 'hardware',
      'hardware': 'hardware', 'building materials': 'hardware',
      'electrical': 'electrical', 'lighting': 'electrical', 'light bulbs': 'electrical',
      'plumbing': 'plumbing', 'bath': 'plumbing', 'kitchen': 'plumbing',
      'paint': 'paint', 'painting': 'paint', 'stain': 'paint',
      'outdoor': 'outdoor', 'garden': 'outdoor', 'lawn': 'outdoor', 'patio': 'outdoor',
      'home decor': 'home', 'home': 'home', 'storage': 'home', 'cleaning': 'home',
      'furniture': 'home', 'bedding': 'home',
      'electronics': 'electronics', 'computers': 'electronics', 'phones': 'electronics',
      'tv': 'electronics', 'audio': 'electronics', 'cameras': 'electronics',
      'appliances': 'appliances', 'small appliances': 'appliances',
      'health': 'health', 'pharmacy': 'health', 'personal care': 'health', 'beauty': 'health',
      'groceries': 'groceries', 'food': 'groceries', 'beverages': 'groceries',
      'office': 'office', 'office supplies': 'office',
      'safety': 'safety', 'safety equipment': 'safety',
    };
    const lower = (raw || '').toLowerCase().trim();
    for (const [key, val] of Object.entries(mapping)) {
      if (lower.includes(key)) return val;
    }
    return lower || 'uncategorized';
  }

  // Generate a consistent internal store ID
  makeStoreId(externalId) {
    const prefix = this.retailerKey.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    return `${prefix}_${externalId}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(msg) {
    console.log(`[${this.retailerKey}] ${msg}`);
  }

  // ===== DATA PERSISTENCE =====

  saveToFile(data, filename) {
    const dir = path.join(__dirname, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    this.log(`Saved ${filepath}`);
    return filepath;
  }

  getStats() {
    return {
      retailer: this.retailerName,
      ...this.stats,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = BaseScraper;
