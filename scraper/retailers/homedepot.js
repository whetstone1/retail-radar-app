/**
 * Home Depot Scraper
 * 
 * Targets:
 * - Store Locator API: find stores by lat/lng
 * - Product Search API: search products with store-level inventory
 * - Product Detail API: get pricing and availability per store
 * 
 * Home Depot's public APIs power their store finder at homedepot.com/l/
 * and product pages. We access the same public JSON endpoints.
 */

const BaseScraper = require('../base-scraper');
const cheerio = require('cheerio');

class HomeDepotScraper extends BaseScraper {
  constructor() {
    super('homedepot', {
      name: 'Home Depot',
      baseUrl: 'https://www.homedepot.com',
      rateLimit: 2000, // 2s between requests (be polite)
    });

    // Home Depot's store locator API
    this.storeFinderUrl = 'https://www.homedepot.com/l/search';
    // Product search origin
    this.searchOrigin = 'https://www.homedepot.com/s/';
  }

  /**
   * Find Home Depot stores near a location.
   * Uses their store finder page which returns structured data.
   */
  async findStores(lat, lng, radiusMiles = 25) {
    this.log(`Finding stores near ${lat}, ${lng} (${radiusMiles}mi radius)`);

    try {
      // Home Depot store locator API endpoint
      const url = `https://www.homedepot.com/l/search/${lat}/${lng}/${radiusMiles}`;

      const html = await this.fetchWithRetry(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
        }
      });

      // Parse store data from the page
      const stores = this.parseStoreListPage(html, lat, lng, radiusMiles);
      this.stats.storesFound += stores.length;
      this.log(`Found ${stores.length} stores`);
      return stores;

    } catch (err) {
      this.log(`Store finder error: ${err.message}`);
      // Fallback: use known HD store locations
      return this.getKnownStores(lat, lng, radiusMiles);
    }
  }

  parseStoreListPage(html, lat, lng, radius) {
    if (typeof html !== 'string') return [];
    const $ = cheerio.load(html);
    const stores = [];

    // HD embeds store data in JSON-LD or script tags
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const data = JSON.parse($(el).html());
        if (data['@type'] === 'HardwareStore' || data['@type'] === 'Store') {
          stores.push(this.normalizeStore({
            storeId: data.branchCode || `hd-${i}`,
            name: data.name,
            address: data.address?.streetAddress || '',
            city: data.address?.addressLocality || '',
            state: data.address?.addressRegion || '',
            zip: data.address?.postalCode || '',
            lat: parseFloat(data.geo?.latitude) || lat,
            lng: parseFloat(data.geo?.longitude) || lng,
            phone: data.telephone || '',
            hours: data.openingHours || null,
          }));
        }
      } catch (e) { /* skip malformed JSON */ }
    });

    return stores;
  }

  /**
   * Search for products at a specific Home Depot store.
   * HD search pages embed product data as JSON in the page.
   */
  async searchProducts(storeId, query, page = 1) {
    this.log(`Searching "${query}" at store ${storeId} (page ${page})`);

    try {
      const offset = (page - 1) * 24;
      const url = `${this.baseUrl}/s/${encodeURIComponent(query)}?storeId=${storeId}&Nao=${offset}`;

      const html = await this.fetchWithRetry(url, {
        headers: { 'Accept': 'text/html,application/xhtml+xml' }
      });

      const products = this.parseSearchResults(html, storeId);
      this.stats.productsFound += products.length;
      this.log(`Found ${products.length} products for "${query}"`);
      return products;

    } catch (err) {
      this.log(`Search error for "${query}": ${err.message}`);
      return [];
    }
  }

  parseSearchResults(html, storeId) {
    if (typeof html !== 'string') return [];
    const $ = cheerio.load(html);
    const products = [];

    // HD embeds product data in script tags or data attributes
    $('script').each((i, el) => {
      const content = $(el).html() || '';
      // Look for product data in __NEXT_DATA__ or similar
      if (content.includes('itemList') || content.includes('products')) {
        try {
          const match = content.match(/\"products\"\s*:\s*(\[.*?\])/s);
          if (match) {
            const items = JSON.parse(match[1]);
            items.forEach(item => {
              products.push(this.normalizeProduct({
                productId: item.itemId || item.id,
                sku: item.modelNumber || item.sku,
                name: item.productName || item.name,
                brand: item.brandName || item.brand,
                price: item.price?.value || item.price,
                originalPrice: item.originalPrice?.value,
                category: item.taxonomy?.breadcrumb?.[0] || item.category,
                imageUrl: item.media?.images?.[0]?.url || item.imageUrl,
                url: item.canonicalUrl ? `${this.baseUrl}${item.canonicalUrl}` : '',
                inStock: item.inventory?.isInStock !== false,
                rating: item.ratings?.averageRating,
                reviewCount: item.ratings?.totalReviews,
              }, storeId));
            });
          }
        } catch (e) { /* skip */ }
      }
    });

    // Also try parsing product cards directly from HTML
    if (products.length === 0) {
      $('[data-testid="product-pod"], .product-pod, .plp-pod').each((i, el) => {
        const $el = $(el);
        const name = $el.find('[data-testid="product-header"], .product-title, h2').first().text().trim();
        const priceText = $el.find('[data-testid="product-price"], .price, .price__dollars').first().text().trim();
        const link = $el.find('a[href*="/p/"]').first().attr('href') || '';
        const img = $el.find('img').first().attr('src') || '';

        if (name && priceText) {
          products.push(this.normalizeProduct({
            productId: link.match(/\/(\d+)$/)?.[1] || `hd-${i}`,
            name,
            price: priceText,
            imageUrl: img,
            url: link.startsWith('http') ? link : `${this.baseUrl}${link}`,
            inStock: true,
            category: 'hardware',
          }, storeId));
        }
      });
    }

    return products;
  }

  /**
   * Known Home Depot locations as fallback.
   * In production, these would come from the live API.
   * Source: Home Depot store locator (public data).
   */
  getKnownStores(lat, lng, radiusMiles) {
    const knownStores = [
      // New York Metro
      { storeId: '1226', name: 'Home Depot Brooklyn', address: '600 Atlantic Ave', city: 'Brooklyn', state: 'NY', zip: '11217', lat: 40.6844, lng: -73.9775, phone: '(718) 230-6600' },
      { storeId: '1228', name: 'Home Depot Gowanus', address: '450 Hamilton Ave', city: 'Brooklyn', state: 'NY', zip: '11231', lat: 40.6740, lng: -73.9995, phone: '(718) 832-8553' },
      { storeId: '6168', name: 'Home Depot East New York', address: '579 Gateway Dr', city: 'Brooklyn', state: 'NY', zip: '11239', lat: 40.6469, lng: -73.8750, phone: '(718) 277-5545' },
      { storeId: '1235', name: 'Home Depot Manhattan', address: '980 Third Ave', city: 'New York', state: 'NY', zip: '10022', lat: 40.7580, lng: -73.9659, phone: '(212) 888-1512' },
      { storeId: '1205', name: 'Home Depot Chelsea', address: '40 W 23rd St', city: 'New York', state: 'NY', zip: '10010', lat: 40.7425, lng: -73.9917, phone: '(212) 929-9571' },
      { storeId: '1248', name: 'Home Depot Bronx', address: '925 Exterior St', city: 'Bronx', state: 'NY', zip: '10451', lat: 40.8248, lng: -73.9291, phone: '(718) 860-0375' },
      { storeId: '1296', name: 'Home Depot Queens', address: '139-19 Queens Blvd', city: 'Jamaica', state: 'NY', zip: '11435', lat: 40.7096, lng: -73.8107, phone: '(718) 558-0140' },
      { storeId: '1297', name: 'Home Depot College Point', address: '13901 20th Ave', city: 'College Point', state: 'NY', zip: '11356', lat: 40.7847, lng: -73.8482, phone: '(718) 661-4608' },
      { storeId: '1217', name: 'Home Depot Staten Island', address: '2501 Forest Ave', city: 'Staten Island', state: 'NY', zip: '10303', lat: 40.6355, lng: -74.1672, phone: '(718) 273-0750' },
      // New Jersey
      { storeId: '1259', name: 'Home Depot Jersey City', address: '100 NJ-440', city: 'Jersey City', state: 'NJ', zip: '07305', lat: 40.6965, lng: -74.0947, phone: '(201) 332-1811' },
      { storeId: '1213', name: 'Home Depot Secaucus', address: '200 Mill Creek Dr', city: 'Secaucus', state: 'NJ', zip: '07094', lat: 40.7812, lng: -74.0683, phone: '(201) 271-1200' },
      // Los Angeles
      { storeId: '6627', name: 'Home Depot Los Angeles', address: '1810 W Slauson Ave', city: 'Los Angeles', state: 'CA', zip: '90047', lat: 33.9885, lng: -118.3126, phone: '(323) 290-5200' },
      { storeId: '1009', name: 'Home Depot Burbank', address: '1000 S San Fernando Blvd', city: 'Burbank', state: 'CA', zip: '91502', lat: 34.1642, lng: -118.3253, phone: '(818) 557-7050' },
      { storeId: '6603', name: 'Home Depot Hollywood', address: '5600 Sunset Blvd', city: 'Los Angeles', state: 'CA', zip: '90028', lat: 34.0984, lng: -118.3081, phone: '(323) 461-3083' },
      // Chicago
      { storeId: '1909', name: 'Home Depot Lincoln Park', address: '2555 N Clybourn Ave', city: 'Chicago', state: 'IL', zip: '60614', lat: 41.9290, lng: -87.6683, phone: '(773) 529-0063' },
      { storeId: '1901', name: 'Home Depot South Loop', address: '1300 S Clinton St', city: 'Chicago', state: 'IL', zip: '60607', lat: 41.8651, lng: -87.6422, phone: '(312) 850-1490' },
      // San Francisco
      { storeId: '1030', name: 'Home Depot Colma', address: '200 El Camino Real', city: 'Colma', state: 'CA', zip: '94014', lat: 37.6771, lng: -122.4618, phone: '(650) 758-0640' },
      { storeId: '1086', name: 'Home Depot San Francisco', address: '1505 Bryant St', city: 'San Francisco', state: 'CA', zip: '94103', lat: 37.7690, lng: -122.4097, phone: '(415) 490-3670' },
      // Houston
      { storeId: '6521', name: 'Home Depot Houston Midtown', address: '2727 Fountain View Dr', city: 'Houston', state: 'TX', zip: '77057', lat: 29.7393, lng: -95.4732, phone: '(713) 975-4200' },
      // Miami
      { storeId: '0258', name: 'Home Depot Miami', address: '12500 NW 7th Ave', city: 'Miami', state: 'FL', zip: '33168', lat: 25.8590, lng: -80.2193, phone: '(305) 981-1300' },
      // Washington DC
      { storeId: '4618', name: 'Home Depot DC', address: '901 Rhode Island Ave NE', city: 'Washington', state: 'DC', zip: '20018', lat: 38.9218, lng: -76.9952, phone: '(202) 526-8940' },
      // Boston
      { storeId: '2681', name: 'Home Depot Boston', address: '5 Allstate Rd', city: 'Boston', state: 'MA', zip: '02125', lat: 42.3179, lng: -71.0481, phone: '(617) 442-6110' },
      // Atlanta
      { storeId: '2641', name: 'Home Depot Midtown Atlanta', address: '2455 Paces Ferry Rd', city: 'Atlanta', state: 'GA', zip: '30339', lat: 33.8737, lng: -84.4686, phone: '(770) 432-7099' },
      // Seattle
      { storeId: '4714', name: 'Home Depot Seattle', address: '2701 Utah Ave S', city: 'Seattle', state: 'WA', zip: '98134', lat: 47.5764, lng: -122.3382, phone: '(206) 467-9200' },
      // Denver
      { storeId: '1533', name: 'Home Depot Denver', address: '2000 S Colorado Blvd', city: 'Denver', state: 'CO', zip: '80222', lat: 39.6773, lng: -104.9407, phone: '(303) 757-9288' },
      // Philadelphia
      { storeId: '4145', name: 'Home Depot Philadelphia', address: '2540 S Columbus Blvd', city: 'Philadelphia', state: 'PA', zip: '19148', lat: 39.9203, lng: -75.1418, phone: '(215) 468-5400' },
      // Phoenix
      { storeId: '0462', name: 'Home Depot Phoenix', address: '1720 E Northern Ave', city: 'Phoenix', state: 'AZ', zip: '85020', lat: 33.5564, lng: -112.0530, phone: '(602) 678-0011' },
    ];

    // Filter by distance
    const filtered = knownStores.filter(s => {
      const dist = this.haversine(lat, lng, s.lat, s.lng);
      return dist <= radiusMiles;
    }).map(s => this.normalizeStore(s));

    this.stats.storesFound += filtered.length;
    return filtered;
  }

  haversine(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}

module.exports = HomeDepotScraper;
