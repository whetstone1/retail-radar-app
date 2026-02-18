/**
 * Deep Link Generator — Real Retailer URLs + Affiliate Tags
 * 
 * Generates product search URLs for major retailers so users can click through
 * and buy directly. Supports affiliate/partner tags for revenue.
 * 
 * Most retailers don't expose stable product-level URLs without an API key,
 * so we link to search results scoped to the exact product name — this reliably
 * lands users on or very near the correct product page.
 */

// ============================================
// RETAILER URL PATTERNS
// ============================================
// Each retailer has:
//   - searchUrl: template for product search ({{QUERY}} placeholder)
//   - affiliateParam: query param for affiliate/partner tracking
//   - affiliateTag: your affiliate ID (set via env var or defaults)
//   - storeLocator: URL pattern to find specific store (optional)

const RETAILER_LINKS = {
  homedepot: {
    name: 'Home Depot',
    searchUrl: 'https://www.homedepot.com/s/{{QUERY}}',
    affiliateParam: 'cm_mmc',
    affiliateTag: process.env.HOMEDEPOT_AFFILIATE || 'RetailRadar-_-partner',
    storeLocator: 'https://www.homedepot.com/l/search/{{LAT}}/{{LNG}}/',
    homepage: 'https://www.homedepot.com',
  },
  lowes: {
    name: "Lowe's",
    searchUrl: 'https://www.lowes.com/search?searchTerm={{QUERY}}',
    affiliateParam: 'cm_mmc',
    affiliateTag: process.env.LOWES_AFFILIATE || 'RetailRadar-_-partner',
    storeLocator: 'https://www.lowes.com/store',
    homepage: 'https://www.lowes.com',
  },
  target: {
    name: 'Target',
    searchUrl: 'https://www.target.com/s?searchTerm={{QUERY}}',
    affiliateParam: 'afid',
    affiliateTag: process.env.TARGET_AFFILIATE || 'RetailRadar',
    storeLocator: 'https://www.target.com/store-locator/find-stores',
    homepage: 'https://www.target.com',
  },
  walmart: {
    name: 'Walmart',
    searchUrl: 'https://www.walmart.com/search?q={{QUERY}}',
    affiliateParam: 'affiliates_ad_id',
    affiliateTag: process.env.WALMART_AFFILIATE || 'RetailRadar',
    storeLocator: 'https://www.walmart.com/store/finder',
    homepage: 'https://www.walmart.com',
  },
  bestbuy: {
    name: 'Best Buy',
    searchUrl: 'https://www.bestbuy.com/site/searchpage.jsp?st={{QUERY}}',
    affiliateParam: 'ref',
    affiliateTag: process.env.BESTBUY_AFFILIATE || 'RetailRadar',
    storeLocator: 'https://www.bestbuy.com/site/store-locator',
    homepage: 'https://www.bestbuy.com',
  },
  cvs: {
    name: 'CVS Pharmacy',
    searchUrl: 'https://www.cvs.com/search?searchTerm={{QUERY}}',
    affiliateParam: 'cid',
    affiliateTag: process.env.CVS_AFFILIATE || 'RetailRadar',
    homepage: 'https://www.cvs.com',
  },
  walgreens: {
    name: 'Walgreens',
    searchUrl: 'https://www.walgreens.com/search/results.jsp?Ntt={{QUERY}}',
    affiliateParam: 'ext',
    affiliateTag: process.env.WALGREENS_AFFILIATE || 'RetailRadar',
    homepage: 'https://www.walgreens.com',
  },
  acehardware: {
    name: 'Ace Hardware',
    searchUrl: 'https://www.acehardware.com/search?query={{QUERY}}',
    affiliateParam: 'utm_source',
    affiliateTag: process.env.ACEHARDWARE_AFFILIATE || 'RetailRadar',
    homepage: 'https://www.acehardware.com',
  },
  staples: {
    name: 'Staples',
    searchUrl: 'https://www.staples.com/{{QUERY}}/directory_{{QUERY}}',
    affiliateParam: 'akaession',
    affiliateTag: process.env.STAPLES_AFFILIATE || 'RetailRadar',
    homepage: 'https://www.staples.com',
  },
  ikea: {
    name: 'IKEA',
    searchUrl: 'https://www.ikea.com/us/en/search/?q={{QUERY}}',
    affiliateParam: 'utm_source',
    affiliateTag: process.env.IKEA_AFFILIATE || 'RetailRadar',
    homepage: 'https://www.ikea.com/us/en/',
  },
  costco: {
    name: 'Costco',
    searchUrl: 'https://www.costco.com/CatalogSearch?dept=All&keyword={{QUERY}}',
    affiliateParam: 'utm_source',
    affiliateTag: process.env.COSTCO_AFFILIATE || 'RetailRadar',
    homepage: 'https://www.costco.com',
  },
  wholefoods: {
    name: 'Whole Foods',
    searchUrl: 'https://www.wholefoodsmarket.com/search?text={{QUERY}}',
    affiliateParam: 'utm_source',
    affiliateTag: process.env.WHOLEFOODS_AFFILIATE || 'RetailRadar',
    homepage: 'https://www.wholefoodsmarket.com',
  },
  traderjoes: {
    name: "Trader Joe's",
    // Trader Joe's doesn't have a search page — link to homepage
    searchUrl: 'https://www.traderjoes.com/home/search?q={{QUERY}}&global=yes',
    affiliateParam: 'utm_source',
    affiliateTag: process.env.TRADERJOES_AFFILIATE || 'RetailRadar',
    homepage: 'https://www.traderjoes.com',
  },
  dollargeneral: {
    name: 'Dollar General',
    searchUrl: 'https://www.dollargeneral.com/search?q={{QUERY}}',
    affiliateParam: 'utm_source',
    affiliateTag: process.env.DOLLARGENERAL_AFFILIATE || 'RetailRadar',
    homepage: 'https://www.dollargeneral.com',
  },
  menards: {
    name: 'Menards',
    searchUrl: 'https://www.menards.com/main/search.html?search={{QUERY}}',
    affiliateParam: 'utm_source',
    affiliateTag: process.env.MENARDS_AFFILIATE || 'RetailRadar',
    homepage: 'https://www.menards.com',
  },
};

// ============================================
// URL GENERATORS
// ============================================

/**
 * Generate a deep link URL to a retailer's product search
 * @param {string} retailerKey - e.g. 'homedepot', 'lowes'
 * @param {string} productName - full product name
 * @param {object} options - { includeAffiliate: true, brand: string }
 * @returns {string|null} Full URL or null if retailer unknown
 */
function generateProductUrl(retailerKey, productName, options = {}) {
  const retailer = RETAILER_LINKS[retailerKey];
  if (!retailer) return null;

  const { includeAffiliate = true, brand } = options;

  // Build search query — use product name, optionally prepend brand
  let searchQuery = productName;
  // Some product names already include the brand, so don't double it
  if (brand && !productName.toLowerCase().includes(brand.toLowerCase())) {
    searchQuery = `${brand} ${productName}`;
  }

  // Encode for URL
  const encoded = encodeURIComponent(searchQuery);
  let url = retailer.searchUrl.replace(/\{\{QUERY\}\}/g, encoded);

  // Add affiliate tag
  if (includeAffiliate && retailer.affiliateParam && retailer.affiliateTag) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}${retailer.affiliateParam}=${encodeURIComponent(retailer.affiliateTag)}`;
  }

  // Add UTM tracking
  const utmSep = url.includes('?') ? '&' : '?';
  url += `${utmSep}utm_medium=referral&utm_campaign=retail-radar`;

  return url;
}

/**
 * Generate a store locator URL
 */
function generateStoreUrl(retailerKey, lat, lng) {
  const retailer = RETAILER_LINKS[retailerKey];
  if (!retailer || !retailer.storeLocator) return retailer?.homepage || null;
  return retailer.storeLocator
    .replace('{{LAT}}', lat)
    .replace('{{LNG}}', lng);
}

/**
 * Add deep links to a search result object
 * Modifies the result in place, adding `buyUrl` and `storeUrl` fields
 */
function enrichResultWithLinks(result, retailerKey, product, lat, lng) {
  const productUrl = generateProductUrl(retailerKey, product.name, { brand: product.brand });
  const storeUrl = generateStoreUrl(retailerKey, lat, lng);

  return {
    ...result,
    buyUrl: productUrl,
    storeUrl,
    retailerHomepage: RETAILER_LINKS[retailerKey]?.homepage || null,
  };
}

/**
 * Get retailer key from store brand name
 * e.g. "Home Depot" → "homedepot", "Lowe's" → "lowes"
 */
function brandToKey(brand) {
  if (!brand) return null;
  const lower = brand.toLowerCase().replace(/[^a-z]/g, '');
  // Direct lookup
  if (RETAILER_LINKS[lower]) return lower;
  // Fuzzy match
  for (const [key, val] of Object.entries(RETAILER_LINKS)) {
    if (val.name.toLowerCase().replace(/[^a-z]/g, '') === lower) return key;
  }
  return null;
}

module.exports = {
  RETAILER_LINKS,
  generateProductUrl,
  generateStoreUrl,
  enrichResultWithLinks,
  brandToKey,
};
