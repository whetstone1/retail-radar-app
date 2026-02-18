/**
 * Retail Radar - Expanded Product & Store Catalog
 * 
 * 500+ products across 20+ categories
 * 15 retailers with 300+ store locations across 20+ cities
 * 
 * This data seeds the initial supply - the "Milo.com approach"
 * of scraping/curating product data from major retail chains.
 */

// ============================================
// RETAILER DEFINITIONS (15 chains)
// ============================================
const RETAILERS = {
  homedepot: {
    brand: 'Home Depot',
    categories: ['hardware', 'home', 'outdoor', 'paint', 'plumbing', 'electrical', 'lighting', 'storage', 'flooring'],
    priceModifier: 1.0,
  },
  lowes: {
    brand: "Lowe's",
    categories: ['hardware', 'home', 'outdoor', 'paint', 'plumbing', 'electrical', 'lighting', 'storage', 'flooring'],
    priceModifier: 0.98,
  },
  target: {
    brand: 'Target',
    categories: ['home', 'electronics', 'clothing', 'groceries', 'accessories', 'beauty', 'baby', 'toys', 'office', 'cleaning', 'pets'],
    priceModifier: 1.0,
  },
  walmart: {
    brand: 'Walmart',
    categories: ['groceries', 'home', 'electronics', 'clothing', 'hardware', 'outdoor', 'beauty', 'baby', 'toys', 'office', 'cleaning', 'pets', 'automotive'],
    priceModifier: 0.92,
  },
  bestbuy: {
    brand: 'Best Buy',
    categories: ['electronics', 'appliances', 'accessories'],
    priceModifier: 1.02,
  },
  cvs: {
    brand: 'CVS Pharmacy',
    categories: ['health', 'beauty', 'groceries', 'cleaning'],
    priceModifier: 1.08,
  },
  walgreens: {
    brand: 'Walgreens',
    categories: ['health', 'beauty', 'groceries', 'cleaning'],
    priceModifier: 1.06,
  },
  acehardware: {
    brand: 'Ace Hardware',
    categories: ['hardware', 'outdoor', 'paint', 'plumbing', 'electrical', 'lighting'],
    priceModifier: 1.05,
  },
  staples: {
    brand: 'Staples',
    categories: ['electronics', 'office', 'accessories'],
    priceModifier: 1.0,
  },
  ikea: {
    brand: 'IKEA',
    categories: ['home', 'furniture', 'lighting', 'storage', 'kitchen'],
    priceModifier: 0.90,
  },
  costco: {
    brand: 'Costco',
    categories: ['groceries', 'electronics', 'home', 'clothing', 'health', 'outdoor', 'automotive'],
    priceModifier: 0.85,
  },
  wholefoods: {
    brand: 'Whole Foods',
    categories: ['groceries', 'health', 'beauty'],
    priceModifier: 1.15,
  },
  traderjoes: {
    brand: "Trader Joe's",
    categories: ['groceries'],
    priceModifier: 0.88,
  },
  dollargeneral: {
    brand: 'Dollar General',
    categories: ['groceries', 'home', 'cleaning', 'health', 'beauty'],
    priceModifier: 0.75,
  },
  menards: {
    brand: 'Menards',
    categories: ['hardware', 'home', 'outdoor', 'paint', 'plumbing', 'electrical', 'flooring', 'storage'],
    priceModifier: 0.93,
  },
};

// ============================================
// CITY DEFINITIONS (22 metros)
// ============================================
const CITIES = [
  // NYC Metro
  { city: 'Brooklyn', state: 'NY', lat: 40.6782, lng: -73.9442 },
  { city: 'New York', state: 'NY', lat: 40.7580, lng: -73.9855 },
  { city: 'Queens', state: 'NY', lat: 40.7282, lng: -73.7949 },
  { city: 'Bronx', state: 'NY', lat: 40.8448, lng: -73.8648 },
  { city: 'Jersey City', state: 'NJ', lat: 40.7178, lng: -74.0431 },
  // Major metros
  { city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { city: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
  { city: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  { city: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { city: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
  { city: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
  { city: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
  { city: 'Washington', state: 'DC', lat: 38.9072, lng: -77.0369 },
  { city: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
  { city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
  { city: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
  { city: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
  { city: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784 },
];

// Which retailers exist in which cities (not all retailers in all cities)
const RETAILER_CITY_MAP = {
  homedepot: CITIES.map(c => c.city),  // everywhere
  lowes: CITIES.filter(c => !['Jersey City', 'Bronx'].includes(c.city)).map(c => c.city),
  target: CITIES.map(c => c.city),
  walmart: CITIES.filter(c => !['San Francisco', 'Jersey City'].includes(c.city)).map(c => c.city),
  bestbuy: CITIES.filter(c => !['Bronx', 'Jersey City', 'San Antonio'].includes(c.city)).map(c => c.city),
  cvs: CITIES.slice(0, 18).map(c => c.city),
  walgreens: CITIES.slice(0, 16).map(c => c.city),
  acehardware: ['Brooklyn', 'New York', 'Los Angeles', 'Chicago', 'San Francisco', 'Seattle', 'Portland', 'Denver', 'Boston', 'Austin', 'Philadelphia'],
  staples: ['Brooklyn', 'New York', 'Los Angeles', 'Chicago', 'Boston', 'Washington', 'Philadelphia', 'Houston', 'Dallas'],
  ikea: ['Brooklyn', 'Los Angeles', 'Chicago', 'Houston', 'Dallas', 'Philadelphia', 'Seattle', 'Portland', 'Denver'],
  costco: ['Brooklyn', 'Queens', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'San Diego', 'Dallas', 'San Francisco', 'Seattle', 'Denver', 'Atlanta', 'Miami', 'Washington'],
  wholefoods: ['Brooklyn', 'New York', 'Los Angeles', 'Chicago', 'San Francisco', 'Austin', 'Boston', 'Seattle', 'Portland', 'Washington', 'Denver', 'Atlanta'],
  traderjoes: ['Brooklyn', 'New York', 'Los Angeles', 'Chicago', 'San Francisco', 'Boston', 'Seattle', 'Portland', 'Austin', 'Denver', 'Philadelphia', 'San Diego'],
  dollargeneral: ['Houston', 'Dallas', 'San Antonio', 'Atlanta', 'Miami', 'Phoenix', 'Philadelphia', 'Chicago', 'Denver'],
  menards: ['Chicago', 'Dallas', 'Houston', 'Denver', 'Austin'],
};

// ============================================
// GENERATE STORES (~320 locations)
// ============================================
function generateStores() {
  const stores = [];
  let counter = {};

  for (const [retailerKey, retailer] of Object.entries(RETAILERS)) {
    const cities = RETAILER_CITY_MAP[retailerKey] || [];
    counter[retailerKey] = 0;

    for (const cityName of cities) {
      const cityData = CITIES.find(c => c.city === cityName);
      if (!cityData) continue;

      // 1-3 stores per city depending on retailer & city size
      const numStores = getBigCities().includes(cityName) ? 2 : 1;
      
      for (let i = 0; i < numStores; i++) {
        counter[retailerKey]++;
        const prefix = retailerKey.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
        const stateAbbr = cityData.state;
        const num = String(counter[retailerKey]).padStart(2, '0');
        const storeId = `${prefix}_${stateAbbr}${num}`;

        // Slightly randomize lat/lng so stores aren't stacked
        const latOffset = (hashCode(`${storeId}-lat`) % 40 - 20) / 1000;
        const lngOffset = (hashCode(`${storeId}-lng`) % 40 - 20) / 1000;

        const neighborhood = getNeighborhood(cityName, i);
        stores.push({
          storeId,
          retailer: retailerKey,
          brand: retailer.brand,
          name: `${retailer.brand} ${neighborhood || cityName}`,
          address: generateAddress(cityName, stateAbbr, i),
          lat: cityData.lat + latOffset,
          lng: cityData.lng + lngOffset,
          city: cityName,
          state: stateAbbr,
          phone: generatePhone(storeId),
          hours: '6:00 AM - 10:00 PM',
          categories: retailer.categories,
          source: 'seed',
          scrapedAt: new Date().toISOString(),
        });
      }
    }
  }

  return stores;
}

function getBigCities() {
  return ['Brooklyn', 'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Dallas'];
}

function getNeighborhood(city, idx) {
  const neighborhoods = {
    'Brooklyn': ['Downtown Brooklyn', 'Park Slope', 'Williamsburg', 'Bay Ridge'],
    'New York': ['Midtown', 'Union Square', 'East Harlem', 'Chelsea'],
    'Los Angeles': ['Hollywood', 'Westwood', 'Silver Lake', 'Burbank'],
    'Chicago': ['Lincoln Park', 'South Loop', 'Wicker Park', 'Hyde Park'],
    'Houston': ['Galleria', 'Heights', 'Midtown'],
    'San Francisco': ['SoMa', 'Mission', 'Sunset'],
    'Seattle': ['Capitol Hill', 'Ballard', 'University District'],
    'Boston': ['Fenway', 'Back Bay', 'Cambridge'],
    'Miami': ['Brickell', 'Wynwood', 'Coral Gables'],
    'Washington': ['Columbia Heights', 'Georgetown', 'Navy Yard'],
    'Denver': ['LoDo', 'Cherry Creek', 'Capitol Hill'],
    'Austin': ['Downtown', 'South Congress', 'East Side'],
    'Portland': ['Pearl District', 'Hawthorne', 'Alberta'],
    'Atlanta': ['Buckhead', 'Midtown', 'Decatur'],
    'Phoenix': ['Scottsdale', 'Tempe', 'Downtown'],
    'Dallas': ['Uptown', 'Deep Ellum', 'Plano'],
  };
  const hoods = neighborhoods[city] || [city];
  return hoods[idx % hoods.length];
}

function generateAddress(city, state, idx) {
  const streets = ['Main St', 'Broadway', 'Market St', 'Oak Ave', 'Park Blvd', 'Washington Ave', 'Lincoln Rd', 'Commerce Dr'];
  const num = 100 + (hashCode(`${city}-${idx}`) % 9000);
  return `${num} ${streets[idx % streets.length]}, ${city}, ${state}`;
}

function generatePhone(seed) {
  const h = Math.abs(hashCode(seed));
  return `(${200 + (h % 800)}) ${200 + (h % 800)}-${1000 + (h % 9000)}`;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return hash;
}

// ============================================
// PRODUCT CATALOG (500+ items, 20+ categories)
// ============================================
const PRODUCTS = [
  // ─── HARDWARE: POWER TOOLS (25) ───
  { sku: 'RR-PT-001', name: 'DeWalt 20V MAX Cordless Drill/Driver Kit', price: 99.00, category: 'hardware', brand: 'DeWalt', keywords: ['drill','cordless','dewalt','power tool','20v'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-PT-002', name: 'Black+Decker 20V Drill/Driver Kit', price: 49.99, category: 'hardware', brand: 'Black+Decker', keywords: ['drill','driver','cordless','20v'], retailers: ['homedepot','lowes','walmart','target'] },
  { sku: 'RR-PT-003', name: 'Milwaukee M18 Impact Driver', price: 129.00, category: 'hardware', brand: 'Milwaukee', keywords: ['impact driver','milwaukee','cordless','m18'], retailers: ['homedepot','acehardware'] },
  { sku: 'RR-PT-004', name: 'DeWalt 7-1/4" Circular Saw', price: 139.00, category: 'hardware', brand: 'DeWalt', keywords: ['circular saw','saw','dewalt','cutting'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-PT-005', name: 'Bosch Jigsaw Variable Speed', price: 119.00, category: 'hardware', brand: 'Bosch', keywords: ['jigsaw','saw','bosch'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PT-006', name: 'Ryobi 18V Cordless Sander', price: 59.99, category: 'hardware', brand: 'Ryobi', keywords: ['sander','ryobi','orbital'], retailers: ['homedepot'] },
  { sku: 'RR-PT-007', name: 'DeWalt 4.5" Angle Grinder', price: 59.00, category: 'hardware', brand: 'DeWalt', keywords: ['grinder','angle grinder','dewalt'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-PT-008', name: 'Makita 18V LXT Reciprocating Saw', price: 109.00, category: 'hardware', brand: 'Makita', keywords: ['reciprocating saw','sawzall','makita'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PT-009', name: 'Ryobi 10" Compound Miter Saw', price: 159.00, category: 'hardware', brand: 'Ryobi', keywords: ['miter saw','compound','ryobi'], retailers: ['homedepot'] },
  { sku: 'RR-PT-010', name: 'DeWalt 20V MAX Oscillating Tool', price: 99.00, category: 'hardware', brand: 'DeWalt', keywords: ['oscillating tool','multi tool','dewalt'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PT-011', name: 'Milwaukee M12 Rotary Tool', price: 79.00, category: 'hardware', brand: 'Milwaukee', keywords: ['rotary tool','dremel','milwaukee'], retailers: ['homedepot','acehardware'] },
  { sku: 'RR-PT-012', name: 'Craftsman V20 Drill/Driver Combo', price: 139.00, category: 'hardware', brand: 'Craftsman', keywords: ['drill','driver','combo','craftsman'], retailers: ['lowes','acehardware'] },
  { sku: 'RR-PT-013', name: 'Bosch 18V Hammer Drill', price: 169.00, category: 'hardware', brand: 'Bosch', keywords: ['hammer drill','bosch','concrete','masonry'], retailers: ['homedepot','lowes'] },
  { sku: 'RR-PT-014', name: 'RIDGID 18V Brushless Drill', price: 89.00, category: 'hardware', brand: 'RIDGID', keywords: ['drill','ridgid','brushless'], retailers: ['homedepot'] },
  { sku: 'RR-PT-015', name: 'Ryobi 40V Leaf Blower', price: 149.00, category: 'hardware', brand: 'Ryobi', keywords: ['leaf blower','blower','ryobi','40v'], retailers: ['homedepot'] },
  { sku: 'RR-PT-016', name: 'DeWalt Table Saw 8-1/4"', price: 299.00, category: 'hardware', brand: 'DeWalt', keywords: ['table saw','saw','dewalt'], retailers: ['homedepot','lowes'] },
  { sku: 'RR-PT-017', name: 'Milwaukee M18 FUEL Chainsaw 16"', price: 349.00, category: 'hardware', brand: 'Milwaukee', keywords: ['chainsaw','milwaukee','fuel'], retailers: ['homedepot','acehardware'] },
  { sku: 'RR-PT-018', name: 'Ryobi 18V Brad Nailer', price: 99.00, category: 'hardware', brand: 'Ryobi', keywords: ['nailer','brad nailer','ryobi'], retailers: ['homedepot'] },
  { sku: 'RR-PT-019', name: 'Makita 18V LXT Router', price: 179.00, category: 'hardware', brand: 'Makita', keywords: ['router','wood router','makita'], retailers: ['homedepot','lowes'] },
  { sku: 'RR-PT-020', name: 'DEWALT 20V MAX Heat Gun', price: 79.00, category: 'hardware', brand: 'DeWalt', keywords: ['heat gun','dewalt','stripping'], retailers: ['homedepot','lowes'] },
  { sku: 'RR-PT-021', name: 'Bosch Laser Level 65ft', price: 49.97, category: 'hardware', brand: 'Bosch', keywords: ['laser level','level','bosch'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PT-022', name: 'Dremel 3000 Rotary Tool Kit', price: 59.00, category: 'hardware', brand: 'Dremel', keywords: ['dremel','rotary','craft','engraving'], retailers: ['homedepot','lowes','walmart','acehardware'] },
  { sku: 'RR-PT-023', name: 'Porter-Cable 6-Gal Pancake Compressor', price: 99.00, category: 'hardware', brand: 'Porter-Cable', keywords: ['air compressor','compressor','pancake'], retailers: ['homedepot','lowes'] },
  { sku: 'RR-PT-024', name: 'RIDGID Shop Vac 14 Gallon', price: 89.97, category: 'hardware', brand: 'RIDGID', keywords: ['shop vac','vacuum','wet dry'], retailers: ['homedepot'] },
  { sku: 'RR-PT-025', name: 'Ryobi 18V Cordless Stapler', price: 69.00, category: 'hardware', brand: 'Ryobi', keywords: ['stapler','staple gun','ryobi'], retailers: ['homedepot'] },

  // ─── HARDWARE: HAND TOOLS (25) ───
  { sku: 'RR-HT-001', name: 'Stanley 16oz Claw Hammer', price: 12.97, category: 'hardware', brand: 'Stanley', keywords: ['hammer','claw','stanley'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-HT-002', name: 'Craftsman 11-Piece Screwdriver Set', price: 14.98, category: 'hardware', brand: 'Craftsman', keywords: ['screwdriver','set','craftsman','phillips','flathead'], retailers: ['lowes','acehardware','walmart'] },
  { sku: 'RR-HT-003', name: 'Stanley 25ft Tape Measure', price: 14.98, category: 'hardware', brand: 'Stanley', keywords: ['tape measure','measuring','stanley'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-HT-004', name: 'Crescent 8" Adjustable Wrench', price: 9.97, category: 'hardware', brand: 'Crescent', keywords: ['wrench','adjustable','crescent'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-HT-005', name: 'Channellock 9.5" Pliers', price: 14.97, category: 'hardware', brand: 'Channellock', keywords: ['pliers','channellock','tongue groove'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-HT-006', name: 'IRWIN Vise-Grip 10" Locking Pliers', price: 12.98, category: 'hardware', brand: 'IRWIN', keywords: ['vise grip','locking pliers','irwin'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-HT-007', name: 'Stanley Utility Knife', price: 7.97, category: 'hardware', brand: 'Stanley', keywords: ['utility knife','box cutter','stanley'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-HT-008', name: 'Milwaukee 48-Piece Socket Set', price: 49.97, category: 'hardware', brand: 'Milwaukee', keywords: ['socket set','ratchet','milwaukee'], retailers: ['homedepot','acehardware'] },
  { sku: 'RR-HT-009', name: 'Klein Tools Wire Stripper', price: 19.97, category: 'hardware', brand: 'Klein', keywords: ['wire stripper','electrical','klein'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-HT-010', name: 'Torpedo Level 9"', price: 6.97, category: 'hardware', keywords: ['level','torpedo','bubble'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-HT-011', name: 'Pry Bar Flat 12"', price: 8.97, category: 'hardware', keywords: ['pry bar','flat bar','demolition'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-HT-012', name: 'Putty Knife 3"', price: 3.97, category: 'hardware', keywords: ['putty knife','scraper','spackling'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-HT-013', name: 'Allen Wrench Set (SAE & Metric)', price: 9.97, category: 'hardware', keywords: ['allen wrench','hex key','set'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-HT-014', name: 'Hacksaw with Blade', price: 11.97, category: 'hardware', keywords: ['hacksaw','saw','metal cutting'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-HT-015', name: 'C-Clamp Set 4-Piece', price: 12.97, category: 'hardware', keywords: ['clamp','c-clamp','woodworking'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-HT-016', name: 'Stud Finder Electronic', price: 24.97, category: 'hardware', brand: 'Zircon', keywords: ['stud finder','wall scanner','zircon'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-HT-017', name: 'Magnetic Parts Tray', price: 5.97, category: 'hardware', keywords: ['magnetic tray','parts tray','mechanic'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-HT-018', name: 'Crowbar 30"', price: 15.97, category: 'hardware', keywords: ['crowbar','demolition','pry'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-HT-019', name: 'Workbench Portable Folding', price: 59.97, category: 'hardware', keywords: ['workbench','folding','sawhorse'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-HT-020', name: 'Tool Bag 16" Heavy Duty', price: 24.97, category: 'hardware', keywords: ['tool bag','bag','carrier'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-HT-021', name: 'Work Gloves Leather Large', price: 14.97, category: 'hardware', keywords: ['work gloves','leather','gloves','safety'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-HT-022', name: 'Safety Glasses Clear', price: 3.97, category: 'hardware', keywords: ['safety glasses','goggles','eye protection'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-HT-023', name: 'Knee Pads Professional', price: 19.97, category: 'hardware', keywords: ['knee pads','kneeling','flooring'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-HT-024', name: 'Chalk Line Reel 100ft', price: 8.97, category: 'hardware', brand: 'Stanley', keywords: ['chalk line','marking','construction'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-HT-025', name: 'Speed Square 7"', price: 7.97, category: 'hardware', keywords: ['speed square','rafter square','carpentry'], retailers: ['homedepot','lowes','acehardware','menards'] },

  // ─── HARDWARE: FASTENERS & SUPPLIES (15) ───
  { sku: 'RR-FS-001', name: 'Wood Screws Assortment 200-Pack', price: 9.97, category: 'hardware', keywords: ['screws','wood screws','assortment'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-FS-002', name: 'Drywall Screws #6 1-5/8" 1lb', price: 5.47, category: 'hardware', keywords: ['drywall screws','screws','drywall'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-FS-003', name: 'Nails Finish 2" 1lb Box', price: 4.97, category: 'hardware', keywords: ['nails','finish nails','brad'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-FS-004', name: 'Wall Anchors Drywall 50-Pack', price: 6.97, category: 'hardware', keywords: ['anchors','wall anchors','drywall'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-FS-005', name: 'Duct Tape Silver 60yd', price: 5.97, category: 'hardware', brand: 'Gorilla', keywords: ['duct tape','tape','gorilla'], retailers: ['homedepot','lowes','acehardware','walmart','target','menards'] },
  { sku: 'RR-FS-006', name: 'Super Glue 4-Pack', price: 4.47, category: 'hardware', brand: 'Gorilla', keywords: ['super glue','glue','adhesive','gorilla'], retailers: ['homedepot','lowes','acehardware','walmart','target'] },
  { sku: 'RR-FS-007', name: 'Wood Glue 8oz', price: 4.97, category: 'hardware', brand: 'Titebond', keywords: ['wood glue','glue','woodworking'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-FS-008', name: 'Epoxy 2-Part 5-Minute', price: 5.97, category: 'hardware', brand: 'JB Weld', keywords: ['epoxy','adhesive','jb weld'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-FS-009', name: 'Zip Ties 8" 100-Pack', price: 3.97, category: 'hardware', keywords: ['zip ties','cable ties','ties'], retailers: ['homedepot','lowes','acehardware','walmart','target'] },
  { sku: 'RR-FS-010', name: 'Electrical Tape 5-Pack', price: 4.97, category: 'hardware', brand: '3M', keywords: ['electrical tape','tape','insulation'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-FS-011', name: 'Sandpaper Assorted 20-Sheet', price: 6.97, category: 'hardware', brand: '3M', keywords: ['sandpaper','sanding','grit'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-FS-012', name: 'WD-40 Multi-Use 12oz', price: 5.98, category: 'hardware', brand: 'WD-40', keywords: ['wd-40','lubricant','penetrant','spray'], retailers: ['homedepot','lowes','acehardware','walmart','target','menards'] },
  { sku: 'RR-FS-013', name: 'Bungee Cords Assorted 10-Pack', price: 7.97, category: 'hardware', keywords: ['bungee','cord','tie down'], retailers: ['homedepot','lowes','walmart'] },
  { sku: 'RR-FS-014', name: 'Picture Hanging Kit', price: 6.97, category: 'hardware', keywords: ['picture hanging','hooks','wall'], retailers: ['homedepot','lowes','walmart','target'] },
  { sku: 'RR-FS-015', name: 'Command Strips Large 12-Pack', price: 11.99, category: 'hardware', brand: '3M', keywords: ['command strips','adhesive','hanging','3m'], retailers: ['homedepot','lowes','walmart','target'] },

  // ─── PAINT (15) ───
  { sku: 'RR-PA-001', name: 'Interior Paint White 1 Gallon', price: 32.98, category: 'paint', brand: 'Behr', keywords: ['paint','interior','white','wall','behr'], retailers: ['homedepot'] },
  { sku: 'RR-PA-002', name: 'Paint Roller Kit 9"', price: 8.97, category: 'paint', keywords: ['paint roller','roller','painting'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-PA-003', name: "Painter's Tape 2\" Blue", price: 6.97, category: 'paint', brand: '3M', keywords: ['painters tape','masking','blue tape'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-PA-004', name: 'Paint Brush Set 5-Piece', price: 9.97, category: 'paint', keywords: ['paint brush','brush','trim'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-PA-005', name: 'Drop Cloth 9x12ft', price: 4.97, category: 'paint', keywords: ['drop cloth','tarp','painting'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-PA-006', name: 'Primer White 1 Gallon', price: 19.98, category: 'paint', brand: 'Kilz', keywords: ['primer','paint','base coat','kilz'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-PA-007', name: 'Caulk Silicone White', price: 4.97, category: 'paint', brand: 'DAP', keywords: ['caulk','silicone','seal','dap'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PA-008', name: 'Spray Paint Matte Black 12oz', price: 4.98, category: 'paint', brand: 'Rust-Oleum', keywords: ['spray paint','matte','black','rustoleum'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-PA-009', name: 'Exterior Paint Satin 1 Gallon', price: 38.98, category: 'paint', brand: 'Behr', keywords: ['paint','exterior','satin','behr'], retailers: ['homedepot'] },
  { sku: 'RR-PA-010', name: 'Stain Semi-Transparent 1 Gallon', price: 34.98, category: 'paint', keywords: ['stain','wood stain','deck'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-PA-011', name: 'Chalk Paint 30oz', price: 17.98, category: 'paint', keywords: ['chalk paint','furniture','refinish'], retailers: ['homedepot','lowes','walmart'] },
  { sku: 'RR-PA-012', name: 'Paint Tray Set', price: 3.97, category: 'paint', keywords: ['paint tray','roller tray','painting'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-PA-013', name: 'Wood Filler 16oz', price: 7.97, category: 'paint', brand: 'DAP', keywords: ['wood filler','filler','putty','repair'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PA-014', name: 'Polyurethane Clear Satin 1qt', price: 14.98, category: 'paint', brand: 'Minwax', keywords: ['polyurethane','finish','clear coat','minwax'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PA-015', name: 'Spackle Lightweight 32oz', price: 6.97, category: 'paint', brand: 'DAP', keywords: ['spackle','spackling','wall repair','dap'], retailers: ['homedepot','lowes','acehardware','walmart'] },

  // ─── PLUMBING (15) ───
  { sku: 'RR-PL-001', name: 'Toilet Plunger Heavy Duty', price: 7.98, category: 'plumbing', keywords: ['plunger','toilet','plumbing'], retailers: ['homedepot','lowes','acehardware','walmart','target','menards'] },
  { sku: 'RR-PL-002', name: 'Teflon Tape 3-Pack', price: 2.98, category: 'plumbing', keywords: ['teflon','tape','plumbing','pipe'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-PL-003', name: 'Drain Snake 25ft', price: 19.97, category: 'plumbing', keywords: ['drain snake','drain','clog','auger'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-PL-004', name: 'Shower Head Chrome', price: 14.98, category: 'plumbing', brand: 'Delta', keywords: ['shower head','bathroom','delta'], retailers: ['homedepot','lowes','walmart','target'] },
  { sku: 'RR-PL-005', name: 'Pipe Wrench 14"', price: 15.97, category: 'plumbing', brand: 'Ridgid', keywords: ['pipe wrench','wrench','plumbing','ridgid'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PL-006', name: 'Toilet Repair Kit Universal', price: 12.98, category: 'plumbing', keywords: ['toilet repair','flapper','fill valve'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-PL-007', name: 'Faucet Aerator 2-Pack', price: 4.98, category: 'plumbing', keywords: ['faucet aerator','water saver','faucet'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PL-008', name: 'Drain Cleaner Gel 80oz', price: 7.98, category: 'plumbing', brand: 'Drano', keywords: ['drain cleaner','drano','clog'], retailers: ['homedepot','lowes','walmart','target','cvs','walgreens'] },
  { sku: 'RR-PL-009', name: 'Basin Wrench', price: 12.97, category: 'plumbing', keywords: ['basin wrench','faucet install','plumbing'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PL-010', name: 'Supply Line Braided 3/8" x 20"', price: 6.98, category: 'plumbing', keywords: ['supply line','water line','braided'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-PL-011', name: 'Plumbers Putty 14oz', price: 3.98, category: 'plumbing', keywords: ['plumbers putty','seal','drain'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PL-012', name: 'Water Heater Thermocouple', price: 9.98, category: 'plumbing', keywords: ['thermocouple','water heater','pilot light'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-PL-013', name: 'Wax Ring for Toilet', price: 3.98, category: 'plumbing', keywords: ['wax ring','toilet seal','install'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-PL-014', name: 'Kitchen Faucet Single Handle Chrome', price: 79.00, category: 'plumbing', brand: 'Moen', keywords: ['kitchen faucet','faucet','moen','chrome'], retailers: ['homedepot','lowes'] },
  { sku: 'RR-PL-015', name: 'Bathroom Faucet Brushed Nickel', price: 59.00, category: 'plumbing', brand: 'Delta', keywords: ['bathroom faucet','faucet','delta','nickel'], retailers: ['homedepot','lowes'] },

  // ─── ELECTRICAL (15) ───
  { sku: 'RR-EL-001', name: 'LED Bulb 60W Equiv 4-Pack', price: 6.97, category: 'electrical', keywords: ['led bulb','light bulb','60w'], retailers: ['homedepot','lowes','acehardware','walmart','target','menards'] },
  { sku: 'RR-EL-002', name: 'Smart LED Bulb Color Changing', price: 12.99, category: 'electrical', keywords: ['smart bulb','led','color','wifi'], retailers: ['bestbuy','target','walmart','homedepot'] },
  { sku: 'RR-EL-003', name: 'Power Strip Surge 6-Outlet', price: 11.97, category: 'electrical', keywords: ['power strip','surge protector','outlet'], retailers: ['homedepot','lowes','walmart','target','bestbuy','staples'] },
  { sku: 'RR-EL-004', name: 'Extension Cord 25ft 16-Gauge', price: 12.97, category: 'electrical', keywords: ['extension cord','cord','power'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-EL-005', name: 'Wire Nuts Assorted 100-Pack', price: 4.97, category: 'electrical', keywords: ['wire nuts','connectors','electrical'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-EL-006', name: 'Outlet Cover Plate White 10-Pack', price: 3.47, category: 'electrical', keywords: ['outlet cover','wall plate','switch'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-EL-007', name: 'Dimmer Switch Single Pole', price: 14.97, category: 'electrical', brand: 'Lutron', keywords: ['dimmer','switch','light','lutron'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-EL-008', name: 'Voltage Tester Non-Contact', price: 17.97, category: 'electrical', brand: 'Klein', keywords: ['voltage tester','electrical tester','klein'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-EL-009', name: 'GFCI Outlet 15A', price: 14.97, category: 'electrical', keywords: ['gfci','outlet','bathroom','kitchen'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-EL-010', name: 'Batteries AA 24-Pack', price: 14.97, category: 'electrical', brand: 'Duracell', keywords: ['batteries','aa','duracell'], retailers: ['homedepot','lowes','walmart','target','cvs','walgreens','costco'] },
  { sku: 'RR-EL-011', name: 'Batteries AAA 24-Pack', price: 14.97, category: 'electrical', brand: 'Duracell', keywords: ['batteries','aaa','duracell'], retailers: ['homedepot','lowes','walmart','target','cvs','walgreens','costco'] },
  { sku: 'RR-EL-012', name: 'Flashlight LED 1000 Lumens', price: 24.97, category: 'electrical', keywords: ['flashlight','led','bright','lumens'], retailers: ['homedepot','lowes','acehardware','walmart','target'] },
  { sku: 'RR-EL-013', name: 'Motion Sensor Light Outdoor', price: 29.97, category: 'electrical', keywords: ['motion sensor','security light','outdoor'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-EL-014', name: 'Under Cabinet LED Strip 24"', price: 19.97, category: 'electrical', keywords: ['led strip','under cabinet','lighting'], retailers: ['homedepot','lowes','bestbuy'] },
  { sku: 'RR-EL-015', name: 'Smoke Detector Dual Sensor', price: 24.97, category: 'electrical', brand: 'Kidde', keywords: ['smoke detector','alarm','fire','kidde'], retailers: ['homedepot','lowes','walmart','target'] },

  // ─── ELECTRONICS (40) ───
  { sku: 'RR-EC-001', name: 'USB-C Charging Cable 6ft', price: 9.99, category: 'electronics', keywords: ['usb','usb-c','cable','charger'], retailers: ['bestbuy','target','walmart','cvs','staples'] },
  { sku: 'RR-EC-002', name: 'HDMI Cable 6ft 4K', price: 8.99, category: 'electronics', keywords: ['hdmi','cable','tv','monitor','4k'], retailers: ['bestbuy','target','walmart','staples'] },
  { sku: 'RR-EC-003', name: 'AirPods Pro 2nd Gen', price: 189.99, category: 'electronics', brand: 'Apple', keywords: ['airpods','earbuds','wireless','apple'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-EC-004', name: 'Wireless Charger Pad 15W', price: 14.99, category: 'electronics', keywords: ['wireless charger','charging pad','qi'], retailers: ['bestbuy','target','walmart','cvs'] },
  { sku: 'RR-EC-005', name: 'Portable Power Bank 10000mAh', price: 19.99, category: 'electronics', brand: 'Anker', keywords: ['power bank','portable charger','battery','anker'], retailers: ['bestbuy','target','walmart','cvs','walgreens','staples'] },
  { sku: 'RR-EC-006', name: 'Echo Dot 5th Gen', price: 22.99, category: 'electronics', brand: 'Amazon', keywords: ['echo dot','alexa','smart speaker'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-EC-007', name: 'Ring Video Doorbell', price: 59.99, category: 'electronics', brand: 'Ring', keywords: ['ring','doorbell','camera','security'], retailers: ['bestbuy','target','walmart','homedepot','lowes'] },
  { sku: 'RR-EC-008', name: 'Logitech G502 Gaming Mouse', price: 39.99, category: 'electronics', brand: 'Logitech', keywords: ['mouse','gaming','logitech'], retailers: ['bestbuy','target','walmart','staples'] },
  { sku: 'RR-EC-009', name: 'Logitech K380 Wireless Keyboard', price: 29.99, category: 'electronics', brand: 'Logitech', keywords: ['keyboard','wireless','bluetooth','logitech'], retailers: ['bestbuy','target','walmart','staples'] },
  { sku: 'RR-EC-010', name: 'Logitech C920 HD Webcam', price: 49.99, category: 'electronics', brand: 'Logitech', keywords: ['webcam','camera','video','streaming'], retailers: ['bestbuy','target','walmart','staples'] },
  { sku: 'RR-EC-011', name: 'Fire TV Stick 4K', price: 39.99, category: 'electronics', brand: 'Amazon', keywords: ['fire stick','tv','streaming','4k'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-EC-012', name: 'Chromecast with Google TV', price: 29.99, category: 'electronics', brand: 'Google', keywords: ['chromecast','google','streaming'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-EC-013', name: 'Sony WH-1000XM5 Headphones', price: 299.99, category: 'electronics', brand: 'Sony', keywords: ['headphones','sony','noise cancelling','wireless'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-EC-014', name: 'JBL Tune 510BT Headphones', price: 29.99, category: 'electronics', brand: 'JBL', keywords: ['headphones','jbl','bluetooth','wireless'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-EC-015', name: 'JBL Flip 6 Portable Speaker', price: 99.99, category: 'electronics', brand: 'JBL', keywords: ['speaker','bluetooth','portable','waterproof','jbl'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-EC-016', name: 'Phone Case iPhone 15', price: 14.99, category: 'electronics', keywords: ['phone case','iphone','case','protection'], retailers: ['bestbuy','target','walmart','cvs'] },
  { sku: 'RR-EC-017', name: 'MicroSD Card 128GB', price: 14.99, category: 'electronics', brand: 'SanDisk', keywords: ['sd card','micro sd','memory card','sandisk'], retailers: ['bestbuy','target','walmart','staples'] },
  { sku: 'RR-EC-018', name: 'USB Flash Drive 64GB', price: 7.99, category: 'electronics', brand: 'SanDisk', keywords: ['usb drive','flash drive','storage'], retailers: ['bestbuy','target','walmart','staples','cvs'] },
  { sku: 'RR-EC-019', name: 'iPad 10th Gen 64GB', price: 349.00, category: 'electronics', brand: 'Apple', keywords: ['ipad','tablet','apple'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-EC-020', name: 'HP Chromebook 14"', price: 249.99, category: 'electronics', brand: 'HP', keywords: ['laptop','chromebook','hp','computer'], retailers: ['bestbuy','target','walmart','staples','costco'] },
  { sku: 'RR-EC-021', name: 'Dell 24" Monitor 1080p', price: 119.99, category: 'electronics', brand: 'Dell', keywords: ['monitor','dell','display','screen'], retailers: ['bestbuy','walmart','staples','costco'] },
  { sku: 'RR-EC-022', name: 'HP LaserJet Printer', price: 159.99, category: 'electronics', brand: 'HP', keywords: ['printer','laser','hp','office'], retailers: ['bestbuy','target','walmart','staples','costco'] },
  { sku: 'RR-EC-023', name: 'TP-Link Wi-Fi 6 Router', price: 69.99, category: 'electronics', brand: 'TP-Link', keywords: ['router','wifi','wifi 6','internet'], retailers: ['bestbuy','target','walmart','staples','costco'] },
  { sku: 'RR-EC-024', name: 'Nest Thermostat', price: 129.99, category: 'electronics', brand: 'Google', keywords: ['thermostat','nest','smart home','google'], retailers: ['bestbuy','target','walmart','homedepot','lowes'] },
  { sku: 'RR-EC-025', name: 'Apple Watch SE 2nd Gen', price: 249.00, category: 'electronics', brand: 'Apple', keywords: ['apple watch','smartwatch','fitness'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-EC-026', name: 'Samsung Galaxy Buds FE', price: 69.99, category: 'electronics', brand: 'Samsung', keywords: ['earbuds','samsung','wireless','galaxy'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-EC-027', name: 'Roku Streaming Stick 4K+', price: 39.99, category: 'electronics', brand: 'Roku', keywords: ['roku','streaming','4k','tv'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-EC-028', name: 'External SSD 1TB Portable', price: 79.99, category: 'electronics', brand: 'Samsung', keywords: ['ssd','external drive','storage','portable'], retailers: ['bestbuy','target','walmart','staples','costco'] },
  { sku: 'RR-EC-029', name: 'Wireless Mouse Ergonomic', price: 24.99, category: 'electronics', brand: 'Logitech', keywords: ['mouse','wireless','ergonomic','office'], retailers: ['bestbuy','target','walmart','staples'] },
  { sku: 'RR-EC-030', name: 'USB Hub 4-Port 3.0', price: 12.99, category: 'electronics', keywords: ['usb hub','hub','ports','usb 3.0'], retailers: ['bestbuy','target','walmart','staples'] },
  { sku: 'RR-EC-031', name: 'Webcam Ring Light 10"', price: 19.99, category: 'electronics', keywords: ['ring light','webcam light','streaming'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-EC-032', name: 'Noise Cancelling Earbuds Budget', price: 39.99, category: 'electronics', keywords: ['earbuds','noise cancelling','budget','wireless'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-EC-033', name: 'Smart Plug 2-Pack', price: 14.99, category: 'electronics', keywords: ['smart plug','wifi','automation'], retailers: ['bestbuy','target','walmart','homedepot'] },
  { sku: 'RR-EC-034', name: 'Laptop Stand Adjustable', price: 29.99, category: 'electronics', keywords: ['laptop stand','desk','ergonomic'], retailers: ['bestbuy','target','walmart','staples'] },
  { sku: 'RR-EC-035', name: 'Screen Protector iPhone 15 2-Pack', price: 9.99, category: 'electronics', keywords: ['screen protector','iphone','tempered glass'], retailers: ['bestbuy','target','walmart','cvs'] },
  { sku: 'RR-EC-036', name: 'Car Phone Mount Magnetic', price: 12.99, category: 'electronics', keywords: ['car mount','phone mount','magnetic','dashboard'], retailers: ['bestbuy','target','walmart','cvs'] },
  { sku: 'RR-EC-037', name: 'Bluetooth FM Transmitter Car', price: 15.99, category: 'electronics', keywords: ['fm transmitter','bluetooth','car audio'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-EC-038', name: 'Smart Light Switch', price: 19.99, category: 'electronics', keywords: ['smart switch','wifi','light switch'], retailers: ['bestbuy','target','homedepot','lowes'] },
  { sku: 'RR-EC-039', name: 'Tile Mate Bluetooth Tracker', price: 17.99, category: 'electronics', brand: 'Tile', keywords: ['tracker','bluetooth','finder','tile'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-EC-040', name: 'USB-C to USB-A Adapter 2-Pack', price: 7.99, category: 'electronics', keywords: ['adapter','usb-c','usb-a','converter'], retailers: ['bestbuy','target','walmart','staples'] },

  // ─── OUTDOOR & GARDEN (20) ───
  { sku: 'RR-OG-001', name: 'Garden Hose 50ft', price: 24.98, category: 'outdoor', keywords: ['hose','garden','watering','yard'], retailers: ['homedepot','lowes','acehardware','walmart','target','menards'] },
  { sku: 'RR-OG-002', name: 'Garden Gloves 3-Pack', price: 9.97, category: 'outdoor', keywords: ['garden gloves','gloves','gardening'], retailers: ['homedepot','lowes','acehardware','walmart','target'] },
  { sku: 'RR-OG-003', name: 'Pruning Shears', price: 11.97, category: 'outdoor', brand: 'Fiskars', keywords: ['pruning shears','scissors','garden','fiskars'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-OG-004', name: 'Shovel D-Handle', price: 19.97, category: 'outdoor', keywords: ['shovel','digging','garden'], retailers: ['homedepot','lowes','acehardware','walmart','menards'] },
  { sku: 'RR-OG-005', name: 'Leaf Rake 24"', price: 12.97, category: 'outdoor', keywords: ['rake','leaf rake','yard'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-OG-006', name: 'Potting Soil 2 cu ft', price: 8.47, category: 'outdoor', brand: 'Miracle-Gro', keywords: ['soil','potting soil','garden','miracle gro'], retailers: ['homedepot','lowes','acehardware','walmart','target'] },
  { sku: 'RR-OG-007', name: 'Solar Path Lights 8-Pack', price: 19.98, category: 'outdoor', keywords: ['solar lights','path lights','outdoor lighting'], retailers: ['homedepot','lowes','walmart','target'] },
  { sku: 'RR-OG-008', name: 'Charcoal Grill 22"', price: 99.00, category: 'outdoor', brand: 'Weber', keywords: ['grill','charcoal','bbq','barbecue','weber'], retailers: ['homedepot','lowes','walmart','target','acehardware'] },
  { sku: 'RR-OG-009', name: 'Patio Umbrella 9ft', price: 49.99, category: 'outdoor', keywords: ['umbrella','patio','shade','outdoor'], retailers: ['homedepot','lowes','walmart','target'] },
  { sku: 'RR-OG-010', name: 'Lawn Mower Push Gas 21"', price: 299.00, category: 'outdoor', keywords: ['lawn mower','mower','gas','push'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-OG-011', name: 'Weed Killer Concentrate 1 Gal', price: 22.97, category: 'outdoor', brand: 'Roundup', keywords: ['weed killer','herbicide','roundup'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-OG-012', name: 'String Trimmer 20V Cordless', price: 79.00, category: 'outdoor', keywords: ['string trimmer','weed eater','wacker'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-OG-013', name: 'Wheelbarrow 6 cu ft', price: 79.97, category: 'outdoor', keywords: ['wheelbarrow','cart','garden'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-OG-014', name: 'Garden Sprinkler Oscillating', price: 12.97, category: 'outdoor', keywords: ['sprinkler','watering','garden','lawn'], retailers: ['homedepot','lowes','acehardware','walmart','target'] },
  { sku: 'RR-OG-015', name: 'Outdoor Storage Shed 8x6', price: 599.00, category: 'outdoor', keywords: ['shed','storage','outdoor','backyard'], retailers: ['homedepot','lowes','menards'] },
  { sku: 'RR-OG-016', name: 'Bird Feeder Hanging', price: 14.97, category: 'outdoor', keywords: ['bird feeder','birds','garden'], retailers: ['homedepot','lowes','acehardware','walmart','target'] },
  { sku: 'RR-OG-017', name: 'Fire Pit Steel 28"', price: 69.00, category: 'outdoor', keywords: ['fire pit','outdoor','patio','bonfire'], retailers: ['homedepot','lowes','walmart','target'] },
  { sku: 'RR-OG-018', name: 'Pressure Washer 2000 PSI', price: 199.00, category: 'outdoor', keywords: ['pressure washer','power washer','cleaning'], retailers: ['homedepot','lowes','menards'] },
  { sku: 'RR-OG-019', name: 'Landscape Fabric 4x50ft', price: 14.97, category: 'outdoor', keywords: ['landscape fabric','weed barrier','garden'], retailers: ['homedepot','lowes','acehardware'] },
  { sku: 'RR-OG-020', name: 'Mulch Brown 2 cu ft', price: 3.47, category: 'outdoor', keywords: ['mulch','garden','landscaping'], retailers: ['homedepot','lowes','menards'] },

  // ─── HOME & STORAGE (20) ───
  { sku: 'RR-HS-001', name: 'Storage Bins Clear 6-Pack', price: 24.99, category: 'home', keywords: ['storage bins','bins','containers','organizer'], retailers: ['target','walmart','homedepot','lowes'] },
  { sku: 'RR-HS-002', name: 'Hangers Plastic 50-Pack', price: 9.99, category: 'home', keywords: ['hangers','clothes hangers','closet'], retailers: ['target','walmart','ikea'] },
  { sku: 'RR-HS-003', name: 'Shelving Unit 5-Tier', price: 49.99, category: 'home', keywords: ['shelving','shelf','storage','metal'], retailers: ['homedepot','lowes','walmart','target','costco'] },
  { sku: 'RR-HS-004', name: 'Closet Organizer Kit', price: 59.99, category: 'home', keywords: ['closet organizer','closet','storage','wardrobe'], retailers: ['homedepot','lowes','target','walmart','ikea'] },
  { sku: 'RR-HS-005', name: 'Shower Curtain White', price: 12.99, category: 'home', keywords: ['shower curtain','bathroom','curtain'], retailers: ['target','walmart','ikea'] },
  { sku: 'RR-HS-006', name: 'Bath Towels 4-Pack', price: 19.99, category: 'home', keywords: ['towels','bath towels','bathroom'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-HS-007', name: 'Bed Pillows 2-Pack Queen', price: 24.99, category: 'home', keywords: ['pillows','bed','queen','sleeping'], retailers: ['target','walmart','costco','ikea'] },
  { sku: 'RR-HS-008', name: 'Sheet Set Queen Microfiber', price: 29.99, category: 'home', keywords: ['sheets','bed sheets','queen','microfiber'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-HS-009', name: 'Comforter Set Queen', price: 49.99, category: 'home', keywords: ['comforter','bedding','queen'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-HS-010', name: 'Curtain Rod Adjustable 36-72"', price: 14.99, category: 'home', keywords: ['curtain rod','window','hardware'], retailers: ['target','walmart','homedepot','lowes'] },
  { sku: 'RR-HS-011', name: 'Blackout Curtains 2-Pack', price: 24.99, category: 'home', keywords: ['curtains','blackout','window','drapes'], retailers: ['target','walmart','ikea'] },
  { sku: 'RR-HS-012', name: 'Area Rug 5x7 Grey', price: 49.99, category: 'home', keywords: ['rug','area rug','carpet','floor'], retailers: ['target','walmart','ikea','homedepot','lowes'] },
  { sku: 'RR-HS-013', name: 'Coat Hooks Wall Mount 5-Pack', price: 12.99, category: 'home', keywords: ['hooks','coat hooks','wall','entry'], retailers: ['homedepot','lowes','target','walmart','ikea'] },
  { sku: 'RR-HS-014', name: 'Step Ladder 3-Step Folding', price: 39.99, category: 'home', keywords: ['ladder','step ladder','folding'], retailers: ['homedepot','lowes','walmart','target','menards'] },
  { sku: 'RR-HS-015', name: 'Smoke & CO Combo Detector', price: 34.99, category: 'home', brand: 'First Alert', keywords: ['smoke detector','carbon monoxide','alarm','first alert'], retailers: ['homedepot','lowes','walmart','target'] },
  { sku: 'RR-HS-016', name: 'Fire Extinguisher 2.5lb', price: 19.97, category: 'home', keywords: ['fire extinguisher','fire safety','emergency'], retailers: ['homedepot','lowes','walmart','target'] },
  { sku: 'RR-HS-017', name: 'Door Lock Deadbolt', price: 29.97, category: 'home', brand: 'Kwikset', keywords: ['door lock','deadbolt','security','kwikset'], retailers: ['homedepot','lowes','acehardware','walmart'] },
  { sku: 'RR-HS-018', name: 'Smart Doorbell Camera', price: 49.99, category: 'home', brand: 'Blink', keywords: ['doorbell','camera','smart','security','blink'], retailers: ['bestbuy','target','walmart','homedepot'] },
  { sku: 'RR-HS-019', name: 'Wall Mirror 24x36"', price: 29.99, category: 'home', keywords: ['mirror','wall mirror','bathroom','decor'], retailers: ['target','walmart','ikea','homedepot'] },
  { sku: 'RR-HS-020', name: 'Shoe Rack 4-Tier', price: 19.99, category: 'home', keywords: ['shoe rack','shoes','storage','entry'], retailers: ['target','walmart','ikea'] },

  // ─── CLEANING (15) ───
  { sku: 'RR-CL-001', name: 'Swiffer WetJet Starter Kit', price: 27.97, category: 'cleaning', brand: 'Swiffer', keywords: ['swiffer','mop','floor','cleaning','wetjet'], retailers: ['target','walmart','cvs'] },
  { sku: 'RR-CL-002', name: 'Clorox Wipes 75ct 3-Pack', price: 11.99, category: 'cleaning', brand: 'Clorox', keywords: ['clorox','wipes','disinfectant','cleaning'], retailers: ['target','walmart','cvs','walgreens','costco'] },
  { sku: 'RR-CL-003', name: 'Shark Navigator Vacuum', price: 149.99, category: 'cleaning', brand: 'Shark', keywords: ['vacuum','shark','upright','carpet'], retailers: ['target','walmart','bestbuy','costco'] },
  { sku: 'RR-CL-004', name: 'Broom and Dustpan Set', price: 12.99, category: 'cleaning', keywords: ['broom','dustpan','sweep','floor'], retailers: ['target','walmart','homedepot','dollargeneral'] },
  { sku: 'RR-CL-005', name: 'Trash Bags 50ct 13-Gallon', price: 9.99, category: 'cleaning', brand: 'Glad', keywords: ['trash bags','garbage bags','glad'], retailers: ['target','walmart','cvs','walgreens','costco','dollargeneral'] },
  { sku: 'RR-CL-006', name: 'Laundry Detergent 100oz', price: 12.99, category: 'cleaning', brand: 'Tide', keywords: ['laundry detergent','tide','wash','clothes'], retailers: ['target','walmart','cvs','walgreens','costco'] },
  { sku: 'RR-CL-007', name: 'Paper Towels 12-Roll', price: 17.99, category: 'cleaning', brand: 'Bounty', keywords: ['paper towels','kitchen','bounty'], retailers: ['target','walmart','cvs','walgreens','costco'] },
  { sku: 'RR-CL-008', name: 'Dish Soap 28oz', price: 3.99, category: 'cleaning', brand: 'Dawn', keywords: ['dish soap','soap','dishes','dawn'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-CL-009', name: 'All-Purpose Cleaner Spray', price: 3.99, category: 'cleaning', keywords: ['all purpose cleaner','spray','cleaner'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-CL-010', name: 'Toilet Bowl Cleaner 2-Pack', price: 4.99, category: 'cleaning', keywords: ['toilet cleaner','bathroom','bowl cleaner'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-CL-011', name: 'Glass Cleaner Windex 26oz', price: 4.49, category: 'cleaning', brand: 'Windex', keywords: ['glass cleaner','windex','window','spray'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-CL-012', name: 'Sponges Scrub Daddy 3-Pack', price: 8.99, category: 'cleaning', brand: 'Scrub Daddy', keywords: ['sponge','scrub daddy','dishes','cleaning'], retailers: ['target','walmart'] },
  { sku: 'RR-CL-013', name: 'Microfiber Cloth 12-Pack', price: 7.99, category: 'cleaning', keywords: ['microfiber','cloth','cleaning','dusting'], retailers: ['target','walmart','homedepot','costco'] },
  { sku: 'RR-CL-014', name: 'Rubber Gloves Medium', price: 3.49, category: 'cleaning', keywords: ['rubber gloves','cleaning gloves','dish gloves'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-CL-015', name: 'Mop and Bucket Set', price: 24.99, category: 'cleaning', keywords: ['mop','bucket','floor','cleaning'], retailers: ['target','walmart','homedepot'] },

  // ─── HEALTH & BEAUTY (25) ───
  { sku: 'RR-HB-001', name: 'Band-Aids Variety 100ct', price: 7.49, category: 'health', brand: 'Band-Aid', keywords: ['bandaid','bandage','first aid'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-002', name: 'Ibuprofen 200mg 100ct', price: 8.99, category: 'health', brand: 'Advil', keywords: ['ibuprofen','advil','pain relief'], retailers: ['target','walmart','cvs','walgreens','costco','dollargeneral'] },
  { sku: 'RR-HB-003', name: 'Hand Sanitizer 8oz', price: 3.99, category: 'health', brand: 'Purell', keywords: ['hand sanitizer','sanitizer','purell'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-004', name: 'Toothpaste Whitening 2-Pack', price: 6.99, category: 'health', brand: 'Crest', keywords: ['toothpaste','crest','dental','whitening'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-005', name: 'Sunscreen SPF 50 8oz', price: 9.99, category: 'health', keywords: ['sunscreen','spf','sun protection'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-HB-006', name: 'First Aid Kit 250 Piece', price: 16.97, category: 'health', keywords: ['first aid kit','medical','emergency'], retailers: ['target','walmart','cvs','walgreens','homedepot'] },
  { sku: 'RR-HB-007', name: 'N95 Masks 20 Pack', price: 19.99, category: 'health', brand: '3M', keywords: ['mask','n95','respirator','3m'], retailers: ['homedepot','lowes','cvs','walgreens','walmart'] },
  { sku: 'RR-HB-008', name: 'Shampoo Moisturizing 13oz', price: 5.99, category: 'beauty', keywords: ['shampoo','hair','moisturizing'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-009', name: 'Body Lotion 16oz', price: 7.99, category: 'beauty', keywords: ['lotion','body lotion','moisturizer'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-010', name: 'Deodorant Stick 2-Pack', price: 6.99, category: 'beauty', keywords: ['deodorant','antiperspirant'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-011', name: 'Multivitamin Daily 200ct', price: 12.99, category: 'health', keywords: ['multivitamin','vitamins','daily','supplement'], retailers: ['target','walmart','cvs','walgreens','costco'] },
  { sku: 'RR-HB-012', name: 'Allergy Relief 24hr 30ct', price: 14.99, category: 'health', keywords: ['allergy','antihistamine','relief'], retailers: ['target','walmart','cvs','walgreens','costco'] },
  { sku: 'RR-HB-013', name: 'Digital Thermometer', price: 9.99, category: 'health', keywords: ['thermometer','digital','temperature','fever'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-HB-014', name: 'Blood Pressure Monitor', price: 29.99, category: 'health', keywords: ['blood pressure','monitor','health'], retailers: ['target','walmart','cvs','walgreens','costco'] },
  { sku: 'RR-HB-015', name: 'Heating Pad Electric', price: 19.99, category: 'health', keywords: ['heating pad','pain relief','muscle'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-HB-016', name: 'Contact Solution 12oz 2-Pack', price: 11.99, category: 'health', keywords: ['contact solution','eyes','contacts'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-HB-017', name: 'Lip Balm 4-Pack', price: 4.99, category: 'beauty', keywords: ['lip balm','chapstick','lips'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-018', name: 'Cotton Swabs 500ct', price: 3.99, category: 'beauty', keywords: ['cotton swabs','q-tips','bathroom'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-019', name: 'Facial Tissues 3-Box', price: 5.99, category: 'health', brand: 'Kleenex', keywords: ['tissues','kleenex','facial','cold'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-020', name: 'Hair Dryer 1875W', price: 24.99, category: 'beauty', keywords: ['hair dryer','blow dryer','styling'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-HB-021', name: 'Electric Toothbrush', price: 29.99, category: 'health', brand: 'Oral-B', keywords: ['electric toothbrush','oral-b','dental'], retailers: ['target','walmart','cvs','walgreens','costco'] },
  { sku: 'RR-HB-022', name: 'Floss Picks 150ct', price: 3.99, category: 'health', keywords: ['floss','dental','teeth','floss picks'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-023', name: 'Eye Drops Lubricating 15ml', price: 8.99, category: 'health', keywords: ['eye drops','lubricating','dry eyes'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-HB-024', name: 'Nail Clippers Set', price: 4.99, category: 'beauty', keywords: ['nail clippers','grooming','manicure'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-HB-025', name: 'Razors Disposable 12-Pack', price: 7.99, category: 'beauty', keywords: ['razors','shaving','disposable'], retailers: ['target','walmart','cvs','walgreens','dollargeneral'] },

  // ─── OFFICE & SCHOOL (15) ───
  { sku: 'RR-OF-001', name: 'Printer Paper 500 Sheets', price: 7.99, category: 'office', keywords: ['paper','printer paper','copy paper'], retailers: ['target','walmart','staples','cvs'] },
  { sku: 'RR-OF-002', name: 'Pens Blue 12-Pack', price: 3.49, category: 'office', brand: 'Bic', keywords: ['pens','blue','writing','bic'], retailers: ['target','walmart','staples','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-OF-003', name: 'Notebooks College Ruled 5-Pack', price: 8.99, category: 'office', keywords: ['notebook','college ruled','school','writing'], retailers: ['target','walmart','staples','dollargeneral'] },
  { sku: 'RR-OF-004', name: 'Post-It Notes 12-Pack', price: 11.99, category: 'office', brand: '3M', keywords: ['post-it','sticky notes','office','3m'], retailers: ['target','walmart','staples','cvs'] },
  { sku: 'RR-OF-005', name: 'Highlighters 6-Color Pack', price: 4.99, category: 'office', keywords: ['highlighters','markers','school'], retailers: ['target','walmart','staples','dollargeneral'] },
  { sku: 'RR-OF-006', name: 'Sharpie Markers 12-Pack', price: 8.99, category: 'office', brand: 'Sharpie', keywords: ['sharpie','markers','permanent'], retailers: ['target','walmart','staples','cvs'] },
  { sku: 'RR-OF-007', name: 'Binder Clips Assorted 60-Pack', price: 5.99, category: 'office', keywords: ['binder clips','clips','office','paper'], retailers: ['target','walmart','staples'] },
  { sku: 'RR-OF-008', name: 'Tape Dispenser with Refill', price: 4.99, category: 'office', brand: 'Scotch', keywords: ['tape','dispenser','scotch','desk'], retailers: ['target','walmart','staples','cvs'] },
  { sku: 'RR-OF-009', name: 'Scissors 8" Stainless', price: 3.99, category: 'office', keywords: ['scissors','cutting','office'], retailers: ['target','walmart','staples','cvs','dollargeneral'] },
  { sku: 'RR-OF-010', name: 'Stapler with 1000 Staples', price: 6.99, category: 'office', keywords: ['stapler','staples','desk','office'], retailers: ['target','walmart','staples'] },
  { sku: 'RR-OF-011', name: 'File Folders Manila 100-Pack', price: 9.99, category: 'office', keywords: ['file folders','manila','filing','office'], retailers: ['target','walmart','staples'] },
  { sku: 'RR-OF-012', name: 'Dry Erase Markers 8-Pack', price: 6.99, category: 'office', brand: 'Expo', keywords: ['dry erase','markers','whiteboard','expo'], retailers: ['target','walmart','staples'] },
  { sku: 'RR-OF-013', name: 'Calculator Scientific', price: 12.99, category: 'office', brand: 'Texas Instruments', keywords: ['calculator','scientific','math','ti'], retailers: ['target','walmart','staples'] },
  { sku: 'RR-OF-014', name: 'Backpack Laptop 15.6"', price: 29.99, category: 'office', keywords: ['backpack','laptop','school','bag'], retailers: ['target','walmart','staples'] },
  { sku: 'RR-OF-015', name: 'Pencils #2 24-Pack', price: 2.99, category: 'office', keywords: ['pencils','number 2','school','writing'], retailers: ['target','walmart','staples','cvs','dollargeneral'] },

  // ─── GROCERIES & KITCHEN (25) ───
  { sku: 'RR-GK-001', name: 'Coffee K-Cups 24-Pack', price: 14.99, category: 'groceries', keywords: ['coffee','k-cups','keurig','pods'], retailers: ['target','walmart','cvs','walgreens','costco','traderjoes'] },
  { sku: 'RR-GK-002', name: 'Water Bottles 24-Pack 16.9oz', price: 3.99, category: 'groceries', keywords: ['water','bottles','drinking','hydration'], retailers: ['target','walmart','cvs','walgreens','costco','dollargeneral'] },
  { sku: 'RR-GK-003', name: 'Olive Oil Extra Virgin 16oz', price: 6.99, category: 'groceries', keywords: ['olive oil','cooking oil','extra virgin'], retailers: ['target','walmart','wholefoods','traderjoes','costco'] },
  { sku: 'RR-GK-004', name: 'Canned Tomatoes 28oz', price: 1.99, category: 'groceries', keywords: ['canned tomatoes','tomatoes','diced','cooking'], retailers: ['target','walmart','traderjoes','dollargeneral'] },
  { sku: 'RR-GK-005', name: 'Rice Long Grain 5lb', price: 4.99, category: 'groceries', keywords: ['rice','long grain','staple','cooking'], retailers: ['target','walmart','traderjoes','costco','dollargeneral'] },
  { sku: 'RR-GK-006', name: 'Pasta Spaghetti 16oz', price: 1.49, category: 'groceries', keywords: ['pasta','spaghetti','noodles','italian'], retailers: ['target','walmart','traderjoes','dollargeneral'] },
  { sku: 'RR-GK-007', name: 'Cereal Honey Nut 19.5oz', price: 4.49, category: 'groceries', keywords: ['cereal','breakfast','honey nut'], retailers: ['target','walmart','cvs','walgreens','costco','dollargeneral'] },
  { sku: 'RR-GK-008', name: 'Peanut Butter Creamy 16oz', price: 3.49, category: 'groceries', keywords: ['peanut butter','spread','sandwich'], retailers: ['target','walmart','traderjoes','dollargeneral'] },
  { sku: 'RR-GK-009', name: 'Bread White Whole Wheat', price: 3.99, category: 'groceries', keywords: ['bread','wheat','sandwich','loaf'], retailers: ['target','walmart','traderjoes','wholefoods'] },
  { sku: 'RR-GK-010', name: 'Eggs Large Grade A Dozen', price: 3.99, category: 'groceries', keywords: ['eggs','dozen','grade a','breakfast'], retailers: ['target','walmart','traderjoes','wholefoods','costco'] },
  { sku: 'RR-GK-011', name: 'Milk Whole Gallon', price: 4.49, category: 'groceries', keywords: ['milk','whole','gallon','dairy'], retailers: ['target','walmart','traderjoes','wholefoods','costco'] },
  { sku: 'RR-GK-012', name: 'Butter Unsalted 1lb', price: 4.99, category: 'groceries', keywords: ['butter','unsalted','baking','cooking'], retailers: ['target','walmart','traderjoes','wholefoods','costco'] },
  { sku: 'RR-GK-013', name: 'Chicken Breast Fresh 2lb', price: 8.99, category: 'groceries', keywords: ['chicken','breast','fresh','meat','poultry'], retailers: ['target','walmart','wholefoods','costco','traderjoes'] },
  { sku: 'RR-GK-014', name: 'Aluminum Foil 75 sq ft', price: 4.99, category: 'groceries', keywords: ['aluminum foil','foil','kitchen','cooking'], retailers: ['target','walmart','cvs','dollargeneral'] },
  { sku: 'RR-GK-015', name: 'Plastic Wrap 200 sq ft', price: 3.99, category: 'groceries', keywords: ['plastic wrap','saran wrap','kitchen'], retailers: ['target','walmart','cvs','dollargeneral'] },
  { sku: 'RR-GK-016', name: 'Ziplock Bags Gallon 75ct', price: 7.99, category: 'groceries', keywords: ['ziplock','bags','storage','kitchen'], retailers: ['target','walmart','cvs','costco'] },
  { sku: 'RR-GK-017', name: 'Salt Iodized 26oz', price: 1.29, category: 'groceries', keywords: ['salt','iodized','seasoning','cooking'], retailers: ['target','walmart','traderjoes','dollargeneral'] },
  { sku: 'RR-GK-018', name: 'Black Pepper Ground 8oz', price: 5.99, category: 'groceries', keywords: ['pepper','black pepper','seasoning','spice'], retailers: ['target','walmart','traderjoes','costco'] },
  { sku: 'RR-GK-019', name: 'Ketchup 32oz', price: 3.99, category: 'groceries', brand: 'Heinz', keywords: ['ketchup','heinz','condiment'], retailers: ['target','walmart','cvs','dollargeneral'] },
  { sku: 'RR-GK-020', name: 'Sugar Granulated 4lb', price: 3.99, category: 'groceries', keywords: ['sugar','granulated','baking'], retailers: ['target','walmart','traderjoes','costco','dollargeneral'] },
  { sku: 'RR-GK-021', name: 'Flour All Purpose 5lb', price: 3.49, category: 'groceries', keywords: ['flour','all purpose','baking'], retailers: ['target','walmart','traderjoes','costco'] },
  { sku: 'RR-GK-022', name: 'Nonstick Frying Pan 10"', price: 19.99, category: 'kitchen', keywords: ['frying pan','skillet','nonstick','cooking'], retailers: ['target','walmart','costco','ikea'] },
  { sku: 'RR-GK-023', name: 'Cutting Board Bamboo', price: 12.99, category: 'kitchen', keywords: ['cutting board','bamboo','kitchen','prep'], retailers: ['target','walmart','ikea'] },
  { sku: 'RR-GK-024', name: 'Kitchen Knife Set 6-Piece', price: 29.99, category: 'kitchen', keywords: ['knife set','knives','kitchen','chef'], retailers: ['target','walmart','costco','ikea'] },
  { sku: 'RR-GK-025', name: 'Mixing Bowls Stainless 3-Set', price: 14.99, category: 'kitchen', keywords: ['mixing bowls','bowls','stainless','baking'], retailers: ['target','walmart','costco','ikea'] },

  // ─── BABY (10) ───
  { sku: 'RR-BB-001', name: 'Diapers Size 3 136ct', price: 34.99, category: 'baby', brand: 'Pampers', keywords: ['diapers','pampers','baby','size 3'], retailers: ['target','walmart','cvs','walgreens','costco'] },
  { sku: 'RR-BB-002', name: 'Baby Wipes 720ct', price: 14.99, category: 'baby', keywords: ['baby wipes','wipes','diaper'], retailers: ['target','walmart','cvs','walgreens','costco'] },
  { sku: 'RR-BB-003', name: 'Baby Formula Powder 23.2oz', price: 29.99, category: 'baby', keywords: ['formula','baby formula','infant','powder'], retailers: ['target','walmart','cvs','walgreens','costco'] },
  { sku: 'RR-BB-004', name: 'Baby Bottles 3-Pack 8oz', price: 14.99, category: 'baby', keywords: ['baby bottles','bottles','feeding','infant'], retailers: ['target','walmart','cvs'] },
  { sku: 'RR-BB-005', name: 'Baby Shampoo Gentle 13.6oz', price: 5.99, category: 'baby', brand: "Johnson's", keywords: ['baby shampoo','gentle','tear free'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-BB-006', name: 'Diaper Cream 4oz', price: 7.99, category: 'baby', brand: 'Desitin', keywords: ['diaper cream','rash cream','baby'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-BB-007', name: 'Pacifiers 2-Pack', price: 6.99, category: 'baby', keywords: ['pacifier','baby','soothing'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-BB-008', name: 'Baby Monitor Video WiFi', price: 59.99, category: 'baby', keywords: ['baby monitor','video','wifi','nursery'], retailers: ['target','walmart','bestbuy'] },
  { sku: 'RR-BB-009', name: 'Swaddle Blankets 3-Pack', price: 19.99, category: 'baby', keywords: ['swaddle','blanket','baby','newborn'], retailers: ['target','walmart'] },
  { sku: 'RR-BB-010', name: 'Baby Food Pouches 12-Pack', price: 12.99, category: 'baby', keywords: ['baby food','pouches','organic','toddler'], retailers: ['target','walmart','wholefoods','traderjoes'] },

  // ─── PETS (10) ───
  { sku: 'RR-PE-001', name: 'Dog Food Dry 30lb', price: 39.99, category: 'pets', keywords: ['dog food','dry food','kibble','pet'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-PE-002', name: 'Cat Litter Clumping 40lb', price: 14.99, category: 'pets', keywords: ['cat litter','clumping','litter box'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-PE-003', name: 'Dog Treats Dental 30ct', price: 12.99, category: 'pets', keywords: ['dog treats','dental','chew'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-PE-004', name: 'Cat Food Canned 24-Pack', price: 19.99, category: 'pets', keywords: ['cat food','canned','wet food'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-PE-005', name: 'Dog Leash 6ft Nylon', price: 9.99, category: 'pets', keywords: ['dog leash','leash','walking','nylon'], retailers: ['target','walmart'] },
  { sku: 'RR-PE-006', name: 'Cat Scratching Post', price: 19.99, category: 'pets', keywords: ['cat','scratching post','scratch','furniture'], retailers: ['target','walmart'] },
  { sku: 'RR-PE-007', name: 'Pet Bed Medium', price: 24.99, category: 'pets', keywords: ['pet bed','dog bed','cat bed','cushion'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-PE-008', name: 'Dog Poop Bags 120ct', price: 6.99, category: 'pets', keywords: ['poop bags','dog bags','waste','biodegradable'], retailers: ['target','walmart','cvs'] },
  { sku: 'RR-PE-009', name: 'Pet Shampoo 16oz', price: 7.99, category: 'pets', keywords: ['pet shampoo','dog shampoo','grooming'], retailers: ['target','walmart','cvs','walgreens'] },
  { sku: 'RR-PE-010', name: 'Dog Toy Chew Rope', price: 5.99, category: 'pets', keywords: ['dog toy','chew toy','rope','play'], retailers: ['target','walmart','dollargeneral'] },

  // ─── TOYS (10) ───
  { sku: 'RR-TY-001', name: 'LEGO Classic Bricks 484-Piece', price: 34.99, category: 'toys', brand: 'LEGO', keywords: ['lego','building','blocks','classic'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-TY-002', name: 'Board Game Monopoly', price: 14.99, category: 'toys', brand: 'Hasbro', keywords: ['monopoly','board game','family','game'], retailers: ['target','walmart'] },
  { sku: 'RR-TY-003', name: 'Play-Doh 10-Pack', price: 7.99, category: 'toys', brand: 'Play-Doh', keywords: ['play-doh','clay','craft','kids'], retailers: ['target','walmart','dollargeneral'] },
  { sku: 'RR-TY-004', name: 'Coloring Book & Crayons Set', price: 5.99, category: 'toys', keywords: ['coloring book','crayons','art','kids'], retailers: ['target','walmart','dollargeneral'] },
  { sku: 'RR-TY-005', name: 'Nerf N-Strike Blaster', price: 19.99, category: 'toys', brand: 'Nerf', keywords: ['nerf','blaster','gun','foam'], retailers: ['target','walmart'] },
  { sku: 'RR-TY-006', name: 'Puzzle 1000-Piece', price: 12.99, category: 'toys', keywords: ['puzzle','jigsaw','1000 piece','family'], retailers: ['target','walmart'] },
  { sku: 'RR-TY-007', name: 'Hot Wheels 5-Pack', price: 5.99, category: 'toys', brand: 'Hot Wheels', keywords: ['hot wheels','cars','toy cars','matchbox'], retailers: ['target','walmart','dollargeneral'] },
  { sku: 'RR-TY-008', name: 'Uno Card Game', price: 5.99, category: 'toys', keywords: ['uno','card game','game','family'], retailers: ['target','walmart','dollargeneral'] },
  { sku: 'RR-TY-009', name: 'Remote Control Car', price: 24.99, category: 'toys', keywords: ['remote control','rc car','toy car','racing'], retailers: ['target','walmart'] },
  { sku: 'RR-TY-010', name: 'Action Figure Collectible', price: 14.99, category: 'toys', keywords: ['action figure','collectible','toy','figure'], retailers: ['target','walmart'] },

  // ─── AUTOMOTIVE (10) ───
  { sku: 'RR-AU-001', name: 'Motor Oil 5W-30 5qt', price: 22.99, category: 'automotive', brand: 'Mobil 1', keywords: ['motor oil','oil','5w-30','synthetic'], retailers: ['walmart','costco'] },
  { sku: 'RR-AU-002', name: 'Windshield Washer Fluid 1 Gal', price: 3.99, category: 'automotive', keywords: ['washer fluid','windshield','wiper fluid'], retailers: ['walmart','homedepot','lowes'] },
  { sku: 'RR-AU-003', name: 'Car Air Freshener 3-Pack', price: 4.99, category: 'automotive', keywords: ['air freshener','car','scent'], retailers: ['walmart','target','cvs','walgreens','dollargeneral'] },
  { sku: 'RR-AU-004', name: 'Jumper Cables 12ft', price: 19.99, category: 'automotive', keywords: ['jumper cables','battery','emergency','car'], retailers: ['walmart','homedepot','lowes'] },
  { sku: 'RR-AU-005', name: 'Tire Pressure Gauge Digital', price: 8.99, category: 'automotive', keywords: ['tire gauge','pressure','tire','digital'], retailers: ['walmart','homedepot'] },
  { sku: 'RR-AU-006', name: 'Car Phone Charger Dual USB', price: 9.99, category: 'automotive', keywords: ['car charger','usb','phone','adapter'], retailers: ['walmart','target','bestbuy','cvs'] },
  { sku: 'RR-AU-007', name: 'Ice Scraper Heavy Duty', price: 6.99, category: 'automotive', keywords: ['ice scraper','windshield','snow','winter'], retailers: ['walmart','homedepot','lowes'] },
  { sku: 'RR-AU-008', name: 'Car Wash Soap 48oz', price: 7.99, category: 'automotive', keywords: ['car wash','soap','cleaning','auto'], retailers: ['walmart','homedepot'] },
  { sku: 'RR-AU-009', name: 'Floor Mats Universal 4-Piece', price: 19.99, category: 'automotive', keywords: ['floor mats','car mats','auto'], retailers: ['walmart','costco'] },
  { sku: 'RR-AU-010', name: 'Emergency Kit Roadside', price: 29.99, category: 'automotive', keywords: ['emergency kit','roadside','breakdown','safety'], retailers: ['walmart','costco'] },

  // ─── FURNITURE (10) ───
  { sku: 'RR-FN-001', name: 'Bookcase 5-Shelf White', price: 69.99, category: 'furniture', keywords: ['bookcase','shelf','bookshelf','storage'], retailers: ['target','walmart','ikea'] },
  { sku: 'RR-FN-002', name: 'Desk Computer 48"', price: 79.99, category: 'furniture', keywords: ['desk','computer desk','office','writing'], retailers: ['target','walmart','ikea','staples'] },
  { sku: 'RR-FN-003', name: 'Office Chair Mesh', price: 99.99, category: 'furniture', keywords: ['office chair','chair','desk','mesh','ergonomic'], retailers: ['target','walmart','ikea','staples','costco'] },
  { sku: 'RR-FN-004', name: 'TV Stand 55" Width', price: 89.99, category: 'furniture', keywords: ['tv stand','entertainment','media','console'], retailers: ['target','walmart','ikea'] },
  { sku: 'RR-FN-005', name: 'Nightstand 2-Drawer', price: 49.99, category: 'furniture', keywords: ['nightstand','bedside','table','drawer'], retailers: ['target','walmart','ikea'] },
  { sku: 'RR-FN-006', name: 'Folding Table 6ft', price: 39.99, category: 'furniture', keywords: ['folding table','table','event','portable'], retailers: ['target','walmart','homedepot','costco'] },
  { sku: 'RR-FN-007', name: 'Folding Chairs 4-Pack', price: 59.99, category: 'furniture', keywords: ['folding chairs','chairs','seating','event'], retailers: ['target','walmart','homedepot','costco'] },
  { sku: 'RR-FN-008', name: 'Dresser 6-Drawer', price: 149.99, category: 'furniture', keywords: ['dresser','drawers','bedroom','storage'], retailers: ['target','walmart','ikea'] },
  { sku: 'RR-FN-009', name: 'Floating Shelves Set of 3', price: 24.99, category: 'furniture', keywords: ['floating shelves','wall shelves','decor'], retailers: ['target','walmart','ikea','homedepot'] },
  { sku: 'RR-FN-010', name: 'Bar Stools 2-Pack 24"', price: 69.99, category: 'furniture', keywords: ['bar stools','stools','counter','kitchen'], retailers: ['target','walmart','ikea','costco'] },

  // ─── CLOTHING BASICS (10) ───
  { sku: 'RR-CB-001', name: 'T-Shirts White 6-Pack', price: 19.99, category: 'clothing', keywords: ['t-shirts','white','basic','undershirt'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-CB-002', name: 'Socks Athletic 12-Pack', price: 14.99, category: 'clothing', keywords: ['socks','athletic','sport','pack'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-CB-003', name: 'Boxer Briefs 4-Pack', price: 19.99, category: 'clothing', keywords: ['underwear','boxer briefs','mens'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-CB-004', name: 'Hoodie Pullover', price: 24.99, category: 'clothing', keywords: ['hoodie','pullover','sweatshirt'], retailers: ['target','walmart'] },
  { sku: 'RR-CB-005', name: 'Jogger Sweatpants', price: 19.99, category: 'clothing', keywords: ['sweatpants','joggers','lounge'], retailers: ['target','walmart'] },
  { sku: 'RR-CB-006', name: 'Rain Jacket Waterproof', price: 29.99, category: 'clothing', keywords: ['rain jacket','waterproof','coat','weather'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-CB-007', name: 'Work Boots Steel Toe', price: 69.99, category: 'clothing', keywords: ['work boots','steel toe','safety','boots'], retailers: ['walmart','homedepot'] },
  { sku: 'RR-CB-008', name: 'Baseball Cap', price: 12.99, category: 'clothing', keywords: ['cap','hat','baseball','sun'], retailers: ['target','walmart'] },
  { sku: 'RR-CB-009', name: 'Winter Gloves Insulated', price: 14.99, category: 'clothing', keywords: ['gloves','winter','insulated','warm'], retailers: ['target','walmart','costco'] },
  { sku: 'RR-CB-010', name: 'Umbrella Compact Travel', price: 9.99, category: 'clothing', keywords: ['umbrella','rain','compact','travel'], retailers: ['target','walmart','cvs','walgreens'] },

  // ─── APPLIANCES (10) ───
  { sku: 'RR-AP-001', name: 'Microwave 1100W Countertop', price: 89.99, category: 'appliances', keywords: ['microwave','countertop','kitchen','1100w'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-AP-002', name: 'Coffee Maker 12-Cup', price: 34.99, category: 'appliances', keywords: ['coffee maker','brewer','drip','12 cup'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-AP-003', name: 'Toaster 2-Slice', price: 24.99, category: 'appliances', keywords: ['toaster','2 slice','bread','breakfast'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-AP-004', name: 'Blender 64oz', price: 39.99, category: 'appliances', keywords: ['blender','smoothie','kitchen','mixing'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-AP-005', name: 'Air Fryer 4qt', price: 59.99, category: 'appliances', keywords: ['air fryer','fryer','cooking','healthy'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-AP-006', name: 'Instant Pot 6qt', price: 79.99, category: 'appliances', brand: 'Instant Pot', keywords: ['instant pot','pressure cooker','slow cooker'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-AP-007', name: 'Stand Mixer 5qt', price: 249.99, category: 'appliances', brand: 'KitchenAid', keywords: ['stand mixer','mixer','kitchenaid','baking'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-AP-008', name: 'Electric Kettle 1.7L', price: 29.99, category: 'appliances', keywords: ['electric kettle','kettle','tea','hot water'], retailers: ['bestbuy','target','walmart'] },
  { sku: 'RR-AP-009', name: 'Food Processor 9-Cup', price: 49.99, category: 'appliances', keywords: ['food processor','chopper','kitchen','prep'], retailers: ['bestbuy','target','walmart','costco'] },
  { sku: 'RR-AP-010', name: 'Iron Steam Compact', price: 24.99, category: 'appliances', keywords: ['iron','steam','clothes','wrinkles'], retailers: ['bestbuy','target','walmart'] },

  // ─── FLOORING & BUILDING (10) ───
  { sku: 'RR-FL-001', name: 'Vinyl Plank Flooring 20 sq ft', price: 29.98, category: 'flooring', keywords: ['vinyl plank','flooring','lvp','floor'], retailers: ['homedepot','lowes','menards'] },
  { sku: 'RR-FL-002', name: 'Laminate Flooring 25 sq ft', price: 34.98, category: 'flooring', keywords: ['laminate','flooring','wood look'], retailers: ['homedepot','lowes','menards'] },
  { sku: 'RR-FL-003', name: 'Floor Tile Ceramic 10-Pack', price: 14.98, category: 'flooring', keywords: ['tile','ceramic','floor','bathroom'], retailers: ['homedepot','lowes','menards'] },
  { sku: 'RR-FL-004', name: 'Grout Sanded 25lb', price: 12.98, category: 'flooring', keywords: ['grout','sanded','tile','floor'], retailers: ['homedepot','lowes'] },
  { sku: 'RR-FL-005', name: 'Underlayment Foam Roll', price: 19.98, category: 'flooring', keywords: ['underlayment','foam','flooring','pad'], retailers: ['homedepot','lowes','menards'] },
  { sku: 'RR-FL-006', name: 'Drywall Sheet 4x8 1/2"', price: 12.98, category: 'flooring', keywords: ['drywall','sheetrock','wall','panel'], retailers: ['homedepot','lowes','menards'] },
  { sku: 'RR-FL-007', name: 'Joint Compound 4.5 Gal', price: 14.97, category: 'flooring', keywords: ['joint compound','mud','drywall','taping'], retailers: ['homedepot','lowes','menards'] },
  { sku: 'RR-FL-008', name: 'Baseboard Molding 8ft', price: 4.98, category: 'flooring', keywords: ['baseboard','molding','trim','finish'], retailers: ['homedepot','lowes','menards'] },
  { sku: 'RR-FL-009', name: 'Concrete Mix 60lb', price: 5.47, category: 'flooring', keywords: ['concrete','cement','mix','pour'], retailers: ['homedepot','lowes','acehardware','menards'] },
  { sku: 'RR-FL-010', name: 'Plywood Sheet 4x8 3/4"', price: 42.98, category: 'flooring', keywords: ['plywood','sheet','wood','panel','lumber'], retailers: ['homedepot','lowes','menards'] },
];

// ============================================
// CATEGORY SUMMARY
// ============================================
function getCategorySummary() {
  const cats = {};
  for (const p of PRODUCTS) {
    cats[p.category] = (cats[p.category] || 0) + 1;
  }
  return cats;
}

module.exports = {
  RETAILERS,
  CITIES,
  RETAILER_CITY_MAP,
  PRODUCTS,
  generateStores,
  getCategorySummary,
  hashCode,
};
