/**
 * Lowe's Scraper
 * Targets Lowe's store locator and product search APIs.
 */

const BaseScraper = require('../base-scraper');
const cheerio = require('cheerio');

class LowesScraper extends BaseScraper {
  constructor() {
    super('lowes', {
      name: "Lowe's",
      baseUrl: 'https://www.lowes.com',
      rateLimit: 2000,
    });
  }

  async findStores(lat, lng, radiusMiles = 25) {
    this.log(`Finding stores near ${lat}, ${lng}`);
    try {
      // Lowe's store locator API
      const url = `https://www.lowes.com/store/api/search?lat=${lat}&long=${lng}&maxResults=20`;
      const data = await this.fetchWithRetry(url);
      
      if (data && Array.isArray(data)) {
        const stores = data.map(s => this.normalizeStore({
          storeId: s.id || s.storeNumber,
          name: s.name || `Lowe's ${s.city}`,
          address: s.address?.streetAddress || s.address1 || '',
          city: s.address?.city || s.city || '',
          state: s.address?.state || s.state || '',
          zip: s.address?.postalCode || s.zip || '',
          lat: s.coordinates?.lat || s.lat,
          lng: s.coordinates?.lng || s.lng,
          phone: s.phone || '',
        }));
        this.stats.storesFound += stores.length;
        return stores;
      }
    } catch (err) {
      this.log(`API error: ${err.message}, using known stores`);
    }
    return this.getKnownStores(lat, lng, radiusMiles);
  }

  async searchProducts(storeId, query, page = 1) {
    this.log(`Searching "${query}" at store ${storeId}`);
    try {
      const offset = (page - 1) * 24;
      const url = `${this.baseUrl}/search?searchTerm=${encodeURIComponent(query)}&offset=${offset}&storeId=${storeId}`;
      const html = await this.fetchWithRetry(url, {
        headers: { 'Accept': 'text/html,application/xhtml+xml' }
      });
      return this.parseSearchResults(html, storeId);
    } catch (err) {
      this.log(`Search error: ${err.message}`);
      return [];
    }
  }

  parseSearchResults(html, storeId) {
    if (typeof html !== 'string') return [];
    const $ = cheerio.load(html);
    const products = [];

    // Parse product cards
    $('[data-selector="splp-prd-tile"], .product-tile, [class*="ProductCard"]').each((i, el) => {
      const $el = $(el);
      const name = $el.find('h3, [class*="title"], [class*="name"]').first().text().trim();
      const price = $el.find('[class*="price"], [data-selector*="price"]').first().text().trim();
      const link = $el.find('a[href*="/pd/"]').first().attr('href') || '';
      const img = $el.find('img').first().attr('src') || '';

      if (name) {
        products.push(this.normalizeProduct({
          productId: link.match(/\/(\d+)$/)?.[1] || `lw-${i}`,
          name, price, imageUrl: img,
          url: link.startsWith('http') ? link : `${this.baseUrl}${link}`,
          inStock: true, category: 'hardware',
        }, storeId));
      }
    });

    this.stats.productsFound += products.length;
    return products;
  }

  getKnownStores(lat, lng, radiusMiles) {
    const stores = [
      { storeId: '1609', name: "Lowe's Brooklyn", address: '118 2nd Ave', city: 'Brooklyn', state: 'NY', zip: '11215', lat: 40.6753, lng: -73.9947, phone: '(718) 491-5100' },
      { storeId: '3312', name: "Lowe's Bronx", address: '2122 Bartow Ave', city: 'Bronx', state: 'NY', zip: '10475', lat: 40.8707, lng: -73.8283, phone: '(718) 862-3650' },
      { storeId: '1905', name: "Lowe's Queens", address: '55-20 Myrtle Ave', city: 'Ridgewood', state: 'NY', zip: '11385', lat: 40.6989, lng: -73.9085, phone: '(718) 456-4520' },
      { storeId: '1760', name: "Lowe's Jersey City", address: '355 Rt 440', city: 'Jersey City', state: 'NJ', zip: '07305', lat: 40.6948, lng: -74.0890, phone: '(201) 332-0700' },
      { storeId: '2830', name: "Lowe's Los Angeles", address: '1752 N Skyline Dr', city: 'Los Angeles', state: 'CA', zip: '90026', lat: 34.0883, lng: -118.2552, phone: '(213) 413-7050' },
      { storeId: '2280', name: "Lowe's Burbank", address: '400 N San Fernando Blvd', city: 'Burbank', state: 'CA', zip: '91502', lat: 34.1900, lng: -118.3276, phone: '(818) 238-6500' },
      { storeId: '1637', name: "Lowe's Chicago", address: '2525 N Elston Ave', city: 'Chicago', state: 'IL', zip: '60647', lat: 41.9267, lng: -87.6765, phone: '(773) 782-4700' },
      { storeId: '0611', name: "Lowe's San Francisco", address: '491 Bayshore Blvd', city: 'San Francisco', state: 'CA', zip: '94124', lat: 37.7328, lng: -122.4030, phone: '(415) 822-6060' },
      { storeId: '2251', name: "Lowe's Houston", address: '4100 San Jacinto St', city: 'Houston', state: 'TX', zip: '77004', lat: 29.7266, lng: -95.3654, phone: '(713) 238-1400' },
      { storeId: '2393', name: "Lowe's Miami", address: '12301 NW 7th Ave', city: 'Miami', state: 'FL', zip: '33168', lat: 25.8580, lng: -80.2180, phone: '(786) 837-4220' },
      { storeId: '3505', name: "Lowe's DC", address: '2438 Market St NE', city: 'Washington', state: 'DC', zip: '20018', lat: 38.9185, lng: -76.9620, phone: '(202) 378-2500' },
      { storeId: '1780', name: "Lowe's Boston", address: '1228 VFW Pkwy', city: 'Boston', state: 'MA', zip: '02132', lat: 42.2870, lng: -71.1512, phone: '(617) 325-1300' },
      { storeId: '2949', name: "Lowe's Atlanta", address: '2475 Ponce de Leon Ave', city: 'Atlanta', state: 'GA', zip: '30307', lat: 33.7717, lng: -84.3490, phone: '(404) 260-9020' },
      { storeId: '2608', name: "Lowe's Seattle", address: '12525 Aurora Ave N', city: 'Seattle', state: 'WA', zip: '98133', lat: 47.7192, lng: -122.3448, phone: '(206) 363-8444' },
      { storeId: '2218', name: "Lowe's Denver", address: '2196 S Colorado Blvd', city: 'Denver', state: 'CO', zip: '80222', lat: 39.6757, lng: -104.9405, phone: '(303) 300-1091' },
      { storeId: '1608', name: "Lowe's Philadelphia", address: '500 W Hunting Park Ave', city: 'Philadelphia', state: 'PA', zip: '19140', lat: 40.0106, lng: -75.1547, phone: '(215) 456-0660' },
    ];

    return stores.filter(s => this.haversine(lat, lng, s.lat, s.lng) <= radiusMiles)
      .map(s => this.normalizeStore(s));
  }

  haversine(lat1, lng1, lat2, lng2) {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}

module.exports = LowesScraper;
