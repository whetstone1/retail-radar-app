/**
 * Retail Radar v3.1 - Full Test Suite (Core + Monetization + Payments)
 * Run: node tests/run-tests.js
 */

process.env.NODE_ENV = 'test';

const BASE_URL = 'http://localhost:3001/api';
let server;
let passed = 0, failed = 0, total = 0;
let customerToken, storeOwnerToken;
let testStoreId;
let testPromotionId;

async function request(method, path, body = null, token = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function assert(condition, message) {
  total++;
  if (condition) { passed++; console.log(`  ✅ ${message}`); }
  else { failed++; console.log(`  ❌ FAIL: ${message}`); }
}

// ============== CORE ==============

async function testHealth() {
  console.log('\n🏥 Health & Docs');
  const { status, data } = await request('GET', '/health');
  assert(status === 200, 'Health check returns 200');
  assert(data.status === 'ok', 'Status is ok');
  assert(data.endpoints.monetization_b2b, 'B2B monetization in endpoint list');
  assert(data.endpoints.monetization_consumer, 'Consumer monetization in endpoint list');
  const docs = await request('GET', '/docs');
  assert(docs.status === 200, 'API docs return 200');
  const mEps = docs.data.endpoints.filter(e => e.path.includes('monetization'));
  assert(mEps.length >= 10, `${mEps.length} monetization endpoints documented`);
}

async function testAuth() {
  console.log('\n🔐 Auth');
  let res = await request('POST', '/auth/register', { email: 'c@test.com', password: 'password123', name: 'Customer' });
  assert(res.status === 201 && res.data.token, 'Register customer');
  customerToken = res.data.token;

  res = await request('POST', '/auth/register', { email: 's@test.com', password: 'password123', name: 'StoreOwner', role: 'store_owner' });
  assert(res.status === 201 && res.data.token, 'Register store owner');
  storeOwnerToken = res.data.token;

  res = await request('POST', '/auth/login', { email: 'c@test.com', password: 'password123' });
  assert(res.status === 200 && res.data.token, 'Login returns token');

  res = await request('POST', '/auth/login', { email: 'c@test.com', password: 'wrong' });
  assert(res.status === 401, 'Bad password rejected');

  res = await request('GET', '/auth/profile', null, customerToken);
  assert(res.status === 200 && res.data.user.email === 'c@test.com', 'Profile works');

  // No token
  res = await request('GET', '/auth/profile');
  assert(res.status === 401, 'No token rejected');
}

async function testSearch() {
  console.log('\n🔍 Search');
  let res = await request('POST', '/search', { query: 'drill', lat: 40.6892, lng: -73.9857 });
  assert(res.status === 200 && res.data.results.length > 0, 'Search "drill" returns results');
  assert(res.data.results[0].bestPrice !== undefined, 'Results include bestPrice');

  res = await request('GET', '/search/categories');
  assert(res.status === 200 && typeof res.data.categories === 'object', 'Categories endpoint returns data');

  res = await request('GET', '/search/suggestions?q=ham');
  assert(res.status === 200 && res.data.suggestions.length > 0, 'Suggestions for "ham"');
}

async function testStores() {
  console.log('\n🏪 Stores');
  let res = await request('GET', '/stores');
  assert(res.status === 200 && res.data.stores.length > 0, 'List stores');
  testStoreId = res.data.stores[0].storeId; // use storeId field

  res = await request('GET', '/stores/nearby?lat=40.6892&lng=-73.9857&radius=15');
  assert(res.status === 200 && res.data.stores.length > 0, 'Nearby stores Brooklyn');

  res = await request('GET', '/stores/retailers');
  assert(res.status === 200 && res.data.retailers.length > 0, 'List retailers');

  res = await request('GET', `/stores/${testStoreId}`);
  assert(res.status === 200 && res.data.store, 'Store detail by ID');
}

async function testInventory() {
  console.log('\n📦 Inventory');
  let res = await request('POST', '/inventory', {
    storeId: testStoreId, productSku: 'TST-001', productName: 'Test Widget',
    category: 'hardware', price: 9.99, quantity: 50
  }, storeOwnerToken);
  assert(res.status === 201 && res.data.item, 'Store owner adds inventory');

  res = await request('POST', '/inventory', {
    storeId: testStoreId, productSku: 'TST-002', productName: 'Denied',
    category: 'hardware', price: 5.99, quantity: 10
  }, customerToken);
  assert(res.status === 403, 'Customer denied inventory write');

  res = await request('GET', `/inventory/stats/${testStoreId}`, null, storeOwnerToken);
  assert(res.status === 200 && res.data.totalProducts > 0, 'Inventory stats');
}

async function testOrders() {
  console.log('\n🛒 Orders');
  const db = require('../backend/models/database');
  const inv = db.inventory.find(i => i.storeId === testStoreId && i.quantity > 0);
  if (!inv) { console.log('  ⚠️ No inventory found, skipping orders'); return; }

  let res = await request('POST', '/orders', {
    items: [{ inventoryId: inv.id, quantity: 1 }],
    fulfillment: 'delivery',
    deliveryAddress: { street: '123 Test St', city: 'Brooklyn', state: 'NY', zip: '11201' }
  }, customerToken);
  assert(res.status === 201 && res.data.order, 'Create order');
  const orderId = res.data.order ? res.data.order.id : null;

  res = await request('GET', '/orders', null, customerToken);
  assert(res.status === 200 && res.data.orders.length > 0, 'List orders');

  if (orderId) {
    res = await request('POST', `/orders/${orderId}/cancel`, null, customerToken);
    assert(res.status === 200, 'Cancel order');
  }
}

async function testNotifications() {
  console.log('\n🔔 Notifications');
  let res = await request('GET', '/notifications', null, customerToken);
  assert(res.status === 200, 'List notifications');
  res = await request('PUT', '/notifications/read-all', null, customerToken);
  assert(res.status === 200, 'Mark all read');
}

// ============== B2B MONETIZATION ==============

async function testB2BPlans() {
  console.log('\n💰 B2B Plans');
  let res = await request('GET', '/monetization/b2b/plans');
  assert(res.status === 200, 'GET plans');
  assert(res.data.platformPlans.length === 4, '4 platform tiers (free/starter/professional/enterprise)');
  assert(res.data.inventorySoftwarePlans.length === 3, '3 inventory software tiers');

  const f = res.data.platformPlans.find(p => p.id === 'free');
  assert(f.price === 0 && f.commission === 0.08, 'Free: $0, 8% commission');
  const s = res.data.platformPlans.find(p => p.id === 'starter');
  assert(s.price === 49, 'Starter: $49/mo');
  const p = res.data.platformPlans.find(p => p.id === 'professional');
  assert(p.price === 149 && p.features.premiumPlacement === true, 'Professional: $149, premium placement');
  const e = res.data.platformPlans.find(p => p.id === 'enterprise');
  assert(e.price === 499 && e.features.marketInsights === 'full', 'Enterprise: $499, full insights');
}

async function testB2BSubscription() {
  console.log('\n💳 B2B Subscriptions');
  let res = await request('POST', '/monetization/b2b/subscribe', {
    storeId: testStoreId, planId: 'starter'
  }, storeOwnerToken);
  assert(res.status === 201 && res.data.subscription, 'Subscribe to Starter');
  assert(res.data.subscription.totalMonthly === 49, '$49/mo total');
  assert(res.data.billing.commissionRate === '5.0%', '5% commission');

  // Upgrade to Professional + Inventory Pro
  res = await request('POST', '/monetization/b2b/subscribe', {
    storeId: testStoreId, planId: 'professional', inventoryPlanId: 'pro'
  }, storeOwnerToken);
  assert(res.status === 201, 'Upgrade to Professional + Inventory Pro');
  assert(res.data.subscription.totalMonthly === 228, '$149 + $79 = $228/mo');
  assert(res.data.subscription.inventoryPlan.planName === 'Inventory Pro', 'Inventory plan attached');

  // Customer cannot
  res = await request('POST', '/monetization/b2b/subscribe', {
    storeId: testStoreId, planId: 'starter'
  }, customerToken);
  assert(res.status === 403, 'Customer blocked from store subscription');

  // Invalid plan
  res = await request('POST', '/monetization/b2b/subscribe', {
    storeId: testStoreId, planId: 'nonexistent'
  }, storeOwnerToken);
  assert(res.status === 400, 'Invalid plan rejected');
}

async function testB2BPromotions() {
  console.log('\n📢 B2B Promoted Listings');
  let res = await request('POST', '/monetization/b2b/promote', {
    storeId: testStoreId, placement: 'search_top', dailyBudget: 10,
  }, storeOwnerToken);
  assert(res.status === 201, 'Create search_top promotion');
  assert(res.data.promotion.pricing.cpc === 0.35, 'CPC = $0.35');
  testPromotionId = res.data.promotion.id;

  res = await request('POST', '/monetization/b2b/promote', {
    storeId: testStoreId, placement: 'homepage_featured', dailyBudget: 25,
  }, storeOwnerToken);
  assert(res.status === 201, 'Create homepage promotion');

  res = await request('POST', '/monetization/b2b/promote', {
    storeId: testStoreId, placement: 'bad_place', dailyBudget: 10,
  }, storeOwnerToken);
  assert(res.status === 400, 'Invalid placement rejected');

  res = await request('POST', '/monetization/b2b/promote', {
    storeId: testStoreId, placement: 'search_top', dailyBudget: 1,
  }, storeOwnerToken);
  assert(res.status === 400, 'Below-minimum budget rejected');

  res = await request('GET', `/monetization/b2b/promotions/${testStoreId}`, null, storeOwnerToken);
  assert(res.status === 200 && res.data.promotions.length >= 2, 'List promotions (2+)');
  assert(res.data.summary !== undefined, 'Promo summary included');
}

async function testB2BInsights() {
  console.log('\n📊 B2B Market Insights');
  let res = await request('GET', `/monetization/b2b/insights/${testStoreId}`, null, storeOwnerToken);
  assert(res.status === 200, 'Insights on Professional plan');
  assert(res.data.demandSignals.topSearches.length > 0, 'Top searches returned');
  assert(res.data.recommendations.length > 0, 'Recommendations returned');
  assert(res.data.demandSignals.missedOpportunities.length > 0, 'Missed opportunities returned');

  // Downgrade → insights blocked
  await request('POST', '/monetization/b2b/subscribe', { storeId: testStoreId, planId: 'starter' }, storeOwnerToken);
  res = await request('GET', `/monetization/b2b/insights/${testStoreId}`, null, storeOwnerToken);
  assert(res.status === 403, 'Insights blocked on Starter');
  assert(res.data.upgrade && res.data.upgrade.plan === 'professional', 'Upgrade prompt shown');

  // Re-upgrade
  await request('POST', '/monetization/b2b/subscribe', { storeId: testStoreId, planId: 'professional' }, storeOwnerToken);
}

async function testB2BBilling() {
  console.log('\n🧾 B2B Billing');
  let res = await request('GET', `/monetization/b2b/billing/${testStoreId}`, null, storeOwnerToken);
  assert(res.status === 200, 'Billing summary');
  assert(res.data.currentPlan.name === 'Professional', 'Current plan = Professional');
  assert(typeof res.data.revenue.grossSales === 'number', 'Revenue is numeric');
  assert(typeof res.data.charges.totalCharges === 'number', 'Total charges is numeric');
}

async function testB2BCancellation() {
  console.log('\n🚫 B2B Cancel');
  let res = await request('POST', '/monetization/b2b/cancel', { storeId: testStoreId }, storeOwnerToken);
  assert(res.status === 200 && res.data.subscription.status === 'cancelling', 'Cancel sets status to cancelling');
  assert(res.data.subscription.cancelsAt, 'End-of-period cancel date set');
  await request('POST', '/monetization/b2b/subscribe', { storeId: testStoreId, planId: 'professional' }, storeOwnerToken);
}

// ============== CONSUMER MONETIZATION ==============

async function testConsumerPlans() {
  console.log('\n🛍️ Consumer Plans');
  let res = await request('GET', '/monetization/consumer/plans');
  assert(res.status === 200, 'GET consumer plans');
  assert(res.data.plans.length === 3, '3 tiers (free/radar_plus/radar_pro)');

  const plus = res.data.plans.find(p => p.id === 'radar_plus');
  assert(plus.price === 7.99 && plus.features.cashback === 0.03, 'Radar+: $7.99, 3% cashback');

  const pro = res.data.plans.find(p => p.id === 'radar_pro');
  assert(pro.price === 14.99 && pro.features.serviceFee === 0, 'Radar Pro: $14.99, 0% service fee');
  assert(res.data.comparison && res.data.comparison.rows.length > 0, 'Comparison table included');
}

async function testConsumerSubscription() {
  console.log('\n💳 Consumer Subscriptions');
  let res = await request('POST', '/monetization/consumer/subscribe', { planId: 'radar_plus' }, customerToken);
  assert(res.status === 201, 'Subscribe to Radar+');
  assert(res.data.subscription.price === 7.99, 'Price = $7.99/mo');
  assert(res.data.subscription.trialEndsAt, '7-day trial started');

  res = await request('GET', '/monetization/consumer/membership', null, customerToken);
  assert(res.status === 200 && res.data.plan.name === 'Radar+', 'Membership = Radar+');
  assert(res.data.features.exclusiveDeals === true, 'Exclusive deals enabled');

  res = await request('POST', '/monetization/consumer/subscribe', { planId: 'radar_pro', billingInterval: 'annual' }, customerToken);
  assert(res.status === 201 && res.data.subscription.price === 99.99, 'Upgrade to Radar Pro annual ($99.99)');

  res = await request('POST', '/monetization/consumer/subscribe', { planId: 'bad' }, customerToken);
  assert(res.status === 400, 'Invalid plan rejected');

  res = await request('POST', '/monetization/consumer/subscribe', { planId: 'radar_plus' });
  assert(res.status === 401, 'Unauthenticated rejected');
}

async function testFeeCalculator() {
  console.log('\n🧮 Fee Calculator');
  // Free user (no auth)
  let res = await request('POST', '/monetization/consumer/calculate-fees', { subtotal: 50, fulfillment: 'delivery' });
  assert(res.status === 200, 'Calculate fees (free user)');
  assert(res.data.breakdown.deliveryFee === 4.99, 'Free: $4.99 delivery');
  assert(res.data.breakdown.serviceFee === 2.50, 'Free: 5% = $2.50 service');
  assert(res.data.upgradePrompt !== null, 'Upgrade prompt for free user');

  // Radar Pro user
  res = await request('POST', '/monetization/consumer/calculate-fees', { subtotal: 50, fulfillment: 'delivery' }, customerToken);
  assert(res.status === 200, 'Calculate fees (Radar Pro)');
  assert(res.data.breakdown.deliveryFee === 0, 'Pro: free delivery');
  assert(res.data.breakdown.serviceFee === 0, 'Pro: no service fee');
  assert(res.data.breakdown.cashback === 2.50, 'Pro: 5% cashback = $2.50');
  assert(res.data.upgradePrompt === null, 'No upgrade prompt for Pro');

  res = await request('POST', '/monetization/consumer/calculate-fees', { subtotal: -5 });
  assert(res.status === 400, 'Negative subtotal rejected');
}

async function testAdPlacements() {
  console.log('\n📣 Ad Placements');
  let res = await request('GET', '/monetization/consumer/ad-placements?page=search');
  assert(res.status === 200 && res.data.privacyNote, 'Search ad placements + privacy note');

  res = await request('GET', '/monetization/consumer/ad-placements?page=homepage');
  assert(res.status === 200, 'Homepage ad placements');

  if (testPromotionId) {
    res = await request('POST', '/monetization/consumer/ad-click', { promotionId: testPromotionId });
    assert(res.status === 200 && res.data.tracked, 'Ad click tracked');
  }
}

async function testConsumerCancel() {
  console.log('\n🚫 Consumer Cancel');
  let res = await request('POST', '/monetization/consumer/cancel', null, customerToken);
  assert(res.status === 200 && res.data.subscription.status === 'cancelling', 'Cancel membership');
}

// ============== RUN ==============

// ============== SCRAPER TESTS ==============

async function testScraper() {
  console.log('\n🕷️ Scraper Framework');
  const ScraperRunner = require('../scraper');
  const HomeDepotScraper = require('../scraper/retailers/homedepot');
  const LowesScraper = require('../scraper/retailers/lowes');
  const { BestBuyScraper, TargetScraper, WalmartScraper, CVSScraper, AceHardwareScraper } = require('../scraper/retailers/others');

  // Test base scraper instantiation
  const hd = new HomeDepotScraper();
  assert(hd.retailerKey === 'homedepot', 'HomeDepot scraper has correct key');
  assert(hd.retailerName === 'Home Depot', 'HomeDepot scraper has correct name');

  const lw = new LowesScraper();
  assert(lw.retailerKey === 'lowes', "Lowe's scraper has correct key");

  const bb = new BestBuyScraper();
  assert(bb.retailerKey === 'bestbuy', 'BestBuy scraper has correct key');

  // Test store finding (Brooklyn area)
  const hdStores = await hd.findStores(40.6892, -73.9857, 15);
  assert(hdStores.length > 0, `HomeDepot found ${hdStores.length} stores near Brooklyn`);
  assert(hdStores[0].retailerKey === 'homedepot', 'Store has correct retailerKey');
  assert(hdStores[0].lat > 0 && hdStores[0].lng < 0, 'Store has valid coordinates');
  assert(hdStores[0].externalStoreId, 'Store has externalStoreId');
  assert(hdStores[0].city, 'Store has city');

  const lwStores = await lw.findStores(40.6892, -73.9857, 15);
  assert(lwStores.length > 0, `Lowes found ${lwStores.length} stores near Brooklyn`);

  const bbStores = await bb.findStores(40.6892, -73.9857, 15);
  assert(bbStores.length > 0, `BestBuy found ${bbStores.length} stores near Brooklyn`);

  const tgtStores = await new TargetScraper().findStores(40.6892, -73.9857, 15);
  assert(tgtStores.length > 0, `Target found ${tgtStores.length} stores near Brooklyn`);

  const wmStores = await new WalmartScraper().findStores(40.6892, -73.9857, 25);
  assert(wmStores.length > 0, `Walmart found ${wmStores.length} stores (25mi radius)`);

  const cvsStores = await new CVSScraper().findStores(40.6892, -73.9857, 15);
  assert(cvsStores.length > 0, `CVS found ${cvsStores.length} stores near Brooklyn`);

  const aceStores = await new AceHardwareScraper().findStores(40.6892, -73.9857, 15);
  assert(aceStores.length > 0, `Ace Hardware found ${aceStores.length} stores near Brooklyn`);

  // Test radius filtering (very small radius should return fewer)
  const hdNarrow = await hd.findStores(40.6892, -73.9857, 2);
  assert(hdNarrow.length <= hdStores.length, `Narrow radius: ${hdNarrow.length} <= ${hdStores.length}`);

  // Test distant location (should find different stores)
  const hdLA = await hd.findStores(34.0522, -118.2437, 25);
  assert(hdLA.length > 0, `HomeDepot found ${hdLA.length} stores in LA`);
  assert(hdLA[0].state === 'CA', 'LA stores are in California');

  // Test data normalization
  assert(hdStores[0].scrapedAt, 'Store has scrapedAt timestamp');
  assert(typeof hdStores[0].lat === 'number', 'Lat is a number');

  // Test price parsing
  assert(hd.parsePrice('$19.99') === 19.99, 'parsePrice handles $19.99');
  assert(hd.parsePrice('1,299.00') === 1299.00, 'parsePrice handles 1,299.00');
  assert(hd.parsePrice(null) === null, 'parsePrice handles null');

  // Test category normalization
  assert(hd.normalizeCategory('Power Tools') === 'hardware', 'normalizeCategory: Power Tools → hardware');
  assert(hd.normalizeCategory('Light Bulbs') === 'electrical', 'normalizeCategory: Light Bulbs → electrical');
  assert(hd.normalizeCategory('garden hose') === 'outdoor', 'normalizeCategory: garden → outdoor');

  // Test runner
  const runner = new ScraperRunner({ lat: 40.6892, lng: -73.9857, radius: 10 });
  const results = await runner.run();
  assert(results.stores.length > 0, `Runner found ${results.stores.length} total stores`);
  assert(results.errors.length === 0, 'Runner had no errors');
  assert(Object.keys(results.stats).length === 7, 'Stats for all 7 retailers');

  // Test database ingestion
  const db = require('../backend/models/database');
  const beforeCount = db.getAllStores().length;
  const ingestion = runner.ingestIntoDatabase(db);
  assert(typeof ingestion.storesAdded === 'number', `Ingested ${ingestion.storesAdded} new stores`);
  assert(typeof ingestion.productsAdded === 'number', `Ingested ${ingestion.productsAdded} products`);
}

async function testScraperAPI() {
  console.log('\n🔌 Scraper API');

  // List available retailers (public endpoint)
  const retailers = await request('GET', '/scraper/retailers');
  assert(retailers.status === 200, 'GET /scraper/retailers returns 200');
  assert(retailers.data.retailers.length >= 7, `${retailers.data.retailers.length} retailers available`);
  assert(retailers.data.retailers.find(r => r.key === 'homedepot'), 'HomeDepot in retailer list');
  assert(retailers.data.retailers.find(r => r.key === 'lowes'), 'Lowes in retailer list');

  // Trigger scrape requires auth
  const noAuth = await request('POST', '/scraper/run', { lat: 40.69, lng: -73.99 });
  assert(noAuth.status === 401, 'Scraper run requires authentication');

  // Trigger scrape with store_owner token
  const run = await request('POST', '/scraper/run', {
    lat: 40.6892, lng: -73.9857, radius: 10, retailer: 'homedepot'
  }, storeOwnerToken);
  assert(run.status === 202, 'Scraper job accepted (202)');
  assert(run.data.jobId, 'Got job ID: ' + run.data.jobId);

  // Wait for job to complete
  await new Promise(r => setTimeout(r, 500));

  // Check job status
  const job = await request('GET', `/scraper/jobs/${run.data.jobId}`, null, storeOwnerToken);
  assert(job.status === 200, 'GET job status returns 200');
  assert(['running', 'completed'].includes(job.data.status), `Job status: ${job.data.status}`);

  // List all jobs
  const jobs = await request('GET', '/scraper/jobs', null, storeOwnerToken);
  assert(jobs.status === 200, 'GET /scraper/jobs returns 200');
  assert(jobs.data.jobs.length > 0, `${jobs.data.jobs.length} scraper jobs listed`);
}

// ============== EXTENSION ENDPOINT TESTS ==============

async function testExtensionEndpoints() {
  console.log('\n🧩 Extension API Endpoints');

  // Search (the main endpoint the extension hits)
  const search = await request('POST', '/search', {
    query: 'drill',
    lat: 40.6892, lng: -73.9857,
    radius: 15, sortBy: 'distance', limit: 5
  });
  assert(search.status === 200, 'Search endpoint returns 200');
  assert(Array.isArray(search.data.results), 'Search returns results array');

  // Search with auth token (extension popup after login)
  const authSearch = await request('POST', '/search', {
    query: 'hammer', lat: 40.6892, lng: -73.9857, radius: 15, limit: 5
  }, customerToken);
  assert(authSearch.status === 200, 'Authenticated search returns 200');

  // Fee calculator (extension uses this for delivery estimates)
  const fees = await request('POST', '/monetization/consumer/calculate-fees', {
    subtotal: 29.99, fulfillment: 'delivery'
  });
  assert(fees.status === 200, 'Fee calculator works without auth');
  assert(fees.data.breakdown?.deliveryFee !== undefined, 'Delivery fee calculated');
  assert(fees.data.breakdown?.total > 0, 'Total fee is positive');

  const authFees = await request('POST', '/monetization/consumer/calculate-fees', {
    subtotal: 29.99, fulfillment: 'delivery'
  }, customerToken);
  assert(authFees.status === 200, 'Fee calculator works with auth');

  // Consumer plans (extension popup shows upgrade prompt)
  const plans = await request('GET', '/monetization/consumer/plans');
  assert(plans.status === 200, 'Consumer plans endpoint returns 200');
  assert(plans.data.plans.length >= 3, 'At least 3 consumer plans');

  // Ad placements (extension could show sponsored results)
  const ads = await request('GET', '/monetization/consumer/ad-placements?page=search&query=drill');
  assert(ads.status === 200, 'Ad placements endpoint returns 200');

  // Auth flow (extension login/register)
  const reg = await request('POST', '/auth/register', {
    email: 'ext_user@test.com', password: 'extPass123', name: 'Extension User'
  });
  assert(reg.status === 201 || reg.status === 200, 'Register from extension works');
  assert(reg.data.token, 'Registration returns JWT token');

  const login = await request('POST', '/auth/login', {
    email: 'ext_user@test.com', password: 'extPass123'
  });
  assert(login.status === 200, 'Login from extension works');
  assert(login.data.token, 'Login returns JWT token');
}

// ============== DASHBOARD TESTS ==============

async function testDashboardClaim() {
  console.log('\n🏪 Dashboard: Store Claim');

  // Available stores (requires auth)
  const available = await request('GET', '/dashboard/available-stores?city=Brooklyn', null, storeOwnerToken);
  assert(available.status === 200, 'GET available stores returns 200');
  assert(available.data.stores.length > 0, `${available.data.stores.length} stores available in Brooklyn`);
  assert(available.data.stores[0].storeId, 'Store has storeId');
  assert(available.data.stores[0].brand, 'Store has brand');

  // Filter by retailer
  const hdOnly = await request('GET', '/dashboard/available-stores?retailer=homedepot', null, storeOwnerToken);
  assert(hdOnly.status === 200, 'Filter by retailer works');
  assert(hdOnly.data.stores.every(s => s.retailer === 'homedepot'), 'All results are Home Depot');

  // Search by name
  const search = await request('GET', '/dashboard/available-stores?q=Target', null, storeOwnerToken);
  assert(search.status === 200, 'Search stores by name works');

  // Pick dynamic store IDs from actual data
  const hdStore = hdOnly.data.stores[0];
  const tgtStore = search.data.stores.find(s => s.retailer === 'target') || available.data.stores.find(s => s.retailer === 'target');
  const hdStoreId = hdStore ? hdStore.storeId : 'HOM_NY01';
  const tgtStoreId = tgtStore ? tgtStore.storeId : 'TAR_NY01';

  // Claim a store
  const claim = await request('POST', '/dashboard/claim-store', { storeId: hdStoreId }, storeOwnerToken);
  assert(claim.status === 200, 'Claim store returns 200');
  assert(claim.data.store && claim.data.store.storeId === hdStoreId, `Claimed ${hdStoreId}`);
  testStoreId = hdStoreId;

  // Duplicate claim rejected
  const dup = await request('POST', '/dashboard/claim-store', { storeId: hdStoreId }, storeOwnerToken);
  assert(dup.status === 400, 'Duplicate claim rejected');

  // Claim second store
  const claim2 = await request('POST', '/dashboard/claim-store', { storeId: tgtStoreId }, storeOwnerToken);
  assert(claim2.status === 200, 'Claimed second store (Target)');

  // My stores
  const my = await request('GET', '/dashboard/my-stores', null, storeOwnerToken);
  assert(my.status === 200, 'GET my-stores returns 200');
  assert(my.data.stores.length === 2, `Has 2 claimed stores`);
  assert(my.data.stores[0].inventoryCount > 0, 'Store has inventory count');

  // Requires auth
  const noAuth = await request('GET', '/dashboard/my-stores');
  assert(noAuth.status === 401, 'my-stores requires auth');

  // Customer blocked
  const blocked = await request('POST', '/dashboard/claim-store', { storeId: hdStoreId }, customerToken);
  assert(blocked.status === 403, 'Customer cannot claim stores');
}

async function testDashboardOverview() {
  console.log('\n📊 Dashboard: Overview');

  const res = await request('GET', '/dashboard/overview/' + testStoreId, null, storeOwnerToken);
  assert(res.status === 200, 'GET overview returns 200');

  const d = res.data;
  assert(d.store.storeId === testStoreId, 'Correct store in response');
  assert(d.store.name, 'Store has name');

  // Inventory section
  assert(typeof d.inventory.total === 'number', 'Inventory total is number');
  assert(d.inventory.total > 0, `${d.inventory.total} total products`);
  assert(typeof d.inventory.inStock === 'number', 'inStock count present');
  assert(typeof d.inventory.lowStock === 'number', 'lowStock count present');
  assert(typeof d.inventory.outOfStock === 'number', 'outOfStock count present');
  assert(d.inventory.totalValue > 0, `Inventory value: $${d.inventory.totalValue}`);
  assert(d.inventory.avgPrice > 0, `Avg price: $${d.inventory.avgPrice}`);
  assert(typeof d.inventory.categories === 'object', 'Category breakdown present');

  // Orders section
  assert(typeof d.orders.total === 'number', 'Orders total present');
  assert(typeof d.orders.pending === 'number', 'Pending orders present');
  assert(typeof d.orders.today === 'object', 'Today metrics present');

  // Subscription section
  assert(d.subscription, 'Subscription section present');

  // Promotions section
  assert(typeof d.promotions.active === 'number', 'Active promos count present');
  assert(typeof d.promotions.clicks === 'number', 'Promo clicks present');

  // Non-existent store
  const bad = await request('GET', '/dashboard/overview/FAKE_STORE', null, storeOwnerToken);
  assert(bad.status === 404, 'Non-existent store returns 404');
}

async function testDashboardInventoryMgmt() {
  console.log('\n📦 Dashboard: Inventory Management');

  // List inventory
  const list = await request('GET', '/dashboard/inventory/' + testStoreId, null, storeOwnerToken);
  assert(list.status === 200, 'GET inventory returns 200');
  assert(list.data.items.length > 0, `${list.data.items.length} items returned`);
  assert(list.data.pagination, 'Pagination present');
  assert(list.data.pagination.total > 0, `Total: ${list.data.pagination.total}`);

  // Filter by category
  const hw = await request('GET', '/dashboard/inventory/' + testStoreId + '?category=hardware', null, storeOwnerToken);
  assert(hw.status === 200, 'Filter by category works');

  // Filter by stock
  const inStock = await request('GET', '/dashboard/inventory/' + testStoreId + '?inStock=true', null, storeOwnerToken);
  assert(inStock.status === 200, 'Filter inStock works');
  assert(inStock.data.items.every(i => i.inStock), 'All items are in stock');

  // Sort
  const sorted = await request('GET', '/dashboard/inventory/' + testStoreId + '?sort=price_desc', null, storeOwnerToken);
  assert(sorted.status === 200, 'Sort by price desc works');
  if (sorted.data.items.length >= 2) {
    assert(sorted.data.items[0].price >= sorted.data.items[1].price, 'Prices are descending');
  }

  // Search
  const srch = await request('GET', '/dashboard/inventory/' + testStoreId + '?q=drill', null, storeOwnerToken);
  assert(srch.status === 200, 'Search by name works');

  // Add product
  const add = await request('POST', '/dashboard/inventory/' + testStoreId + '/add', {
    productName: 'Custom Test Product',
    price: 29.99,
    quantity: 15,
    category: 'hardware',
    brand: 'TestBrand',
  }, storeOwnerToken);
  assert(add.status === 201, 'Add product returns 201');
  assert(add.data.item.productName === 'Custom Test Product', 'Product name correct');
  assert(add.data.item.price === 29.99, 'Price correct');
  assert(add.data.item.inStock === true, 'Auto-set inStock from quantity');
  assert(add.data.item.source === 'manual', 'Source is manual');
  const newItemId = add.data.item.id;

  // Add without required fields
  const badAdd = await request('POST', '/dashboard/inventory/' + testStoreId + '/add', { quantity: 5 }, storeOwnerToken);
  assert(badAdd.status === 400, 'Add without name/price rejected');

  // Edit product
  const edit = await request('PUT', `/dashboard/inventory/${testStoreId}/${newItemId}`, {
    price: 34.99,
    quantity: 20,
    category: 'electrical',
  }, storeOwnerToken);
  assert(edit.status === 200, 'Edit product returns 200');
  assert(edit.data.item.price === 34.99, 'Price updated');
  assert(edit.data.item.quantity === 20, 'Quantity updated');
  assert(edit.data.item.category === 'electrical', 'Category updated');

  // Bulk update
  const inv = (await request('GET', '/dashboard/inventory/' + testStoreId + '?limit=3', null, storeOwnerToken)).data.items;
  const bulk = await request('POST', '/dashboard/inventory/' + testStoreId + '/bulk-update', {
    updates: inv.slice(0, 2).map(i => ({ itemId: i.id, quantity: 99 })),
  }, storeOwnerToken);
  assert(bulk.status === 200, 'Bulk update returns 200');
  assert(bulk.data.updated === 2, '2 items bulk-updated');

  // Delete product
  const del = await request('DELETE', `/dashboard/inventory/${testStoreId}/${newItemId}`, null, storeOwnerToken);
  assert(del.status === 200, 'Delete product returns 200');

  // Delete non-existent
  const badDel = await request('DELETE', '/dashboard/inventory/' + testStoreId + '/fake-id', null, storeOwnerToken);
  assert(badDel.status === 404, 'Delete non-existent returns 404');
}

async function testDashboardOrders() {
  console.log('\n🛒 Dashboard: Order Management');

  // Create an order for the store first - need a real inventory ID
  const invItems = await request('GET', `/dashboard/inventory/${testStoreId}?limit=1`, null, storeOwnerToken);
  const firstItem = invItems.data?.items?.[0];
  let orderId = null;
  if (firstItem) {
    const order = await request('POST', '/orders', {
      items: [{ inventoryId: firstItem.id, quantity: 1 }],
      fulfillment: 'delivery',
      deliveryAddress: '123 Test St, Brooklyn, NY',
    }, customerToken);
    orderId = order.data.order?.id;
  }

  // List store orders
  const list = await request('GET', '/dashboard/orders/' + testStoreId, null, storeOwnerToken);
  assert(list.status === 200, 'GET orders returns 200');
  assert(Array.isArray(list.data.orders), 'Orders is an array');
  assert(list.data.pagination, 'Pagination present');

  // Filter by status
  const pending = await request('GET', '/dashboard/orders/' + testStoreId + '?status=pending', null, storeOwnerToken);
  assert(pending.status === 200, 'Filter by status works');

  // Update order status
  if (orderId) {
    const update = await request('PUT', `/dashboard/orders/${testStoreId}/${orderId}/status`, { status: 'confirmed' }, storeOwnerToken);
    assert(update.status === 200, 'Update order status to confirmed');
    assert(update.data.order.status === 'confirmed', 'Status is confirmed');

    const update2 = await request('PUT', `/dashboard/orders/${testStoreId}/${orderId}/status`, { status: 'preparing' }, storeOwnerToken);
    assert(update2.status === 200, 'Update to preparing');

    const update3 = await request('PUT', `/dashboard/orders/${testStoreId}/${orderId}/status`, { status: 'delivered' }, storeOwnerToken);
    assert(update3.status === 200, 'Update to delivered');

    // Invalid status
    const badStatus = await request('PUT', `/dashboard/orders/${testStoreId}/${orderId}/status`, { status: 'flying' }, storeOwnerToken);
    assert(badStatus.status === 400, 'Invalid status rejected');
  }
}

async function testDashboardAnalytics() {
  console.log('\n📈 Dashboard: Analytics');

  const res = await request('GET', '/dashboard/analytics/' + testStoreId, null, storeOwnerToken);
  assert(res.status === 200, 'GET analytics returns 200');

  const d = res.data;
  assert(Array.isArray(d.topProducts), 'Top products is array');
  assert(d.topProducts.length > 0, `${d.topProducts.length} top products`);
  assert(d.topProducts[0].name, 'Top product has name');
  assert(d.topProducts[0].price, 'Top product has price');

  assert(typeof d.categoryDistribution === 'object', 'Category distribution present');
  assert(Object.keys(d.categoryDistribution).length > 0, 'Has categories');

  assert(typeof d.priceDistribution === 'object', 'Price distribution present');

  assert(Array.isArray(d.dailyRevenue), 'Daily revenue is array');
  assert(d.dailyRevenue.length === 7, '7 days of revenue data');
  assert(d.dailyRevenue[0].date, 'Revenue entry has date');
  assert(d.dailyRevenue[0].day, 'Revenue entry has day name');

  assert(typeof d.inventoryHealth === 'object', 'Inventory health present');
  assert(typeof d.inventoryHealth.healthy === 'number', 'Health: healthy count');
  assert(typeof d.inventoryHealth.low === 'number', 'Health: low count');
  assert(typeof d.inventoryHealth.out === 'number', 'Health: out count');

  assert(typeof d.summary === 'object', 'Summary present');
  assert(d.summary.totalProducts > 0, `Summary: ${d.summary.totalProducts} products`);
  assert(d.summary.inventoryValue > 0, `Summary: $${d.summary.inventoryValue} value`);
}

async function testPortalServed() {
  console.log('\n🌐 Dashboard: Portal HTML');
  const res = await fetch('http://localhost:3001/portal');
  assert(res.status === 200, 'Portal HTML served at /portal');
  const html = await res.text();
  assert(html.includes('Store Portal'), 'HTML contains Store Portal');
  assert(html.includes('Retail Radar'), 'HTML contains Retail Radar branding');
  assert(html.includes('inventory'), 'HTML contains inventory section');
}

// ============== STRIPE PAYMENT TESTS ==============

async function testPaymentConfig() {
  console.log('\n💳 Payments: Config');

  const config = await request('GET', '/payments/config');
  assert(config.status === 200, 'GET /payments/config returns 200');
  assert(config.data.publishableKey, 'Publishable key present');
  assert(config.data.mode === 'mock', 'Running in mock mode');
}

async function testPaymentCustomer() {
  console.log('\n👤 Payments: Customer');

  // Create customer for store owner
  const create = await request('POST', '/payments/create-customer', {}, storeOwnerToken);
  assert(create.status === 201, 'Create customer returns 201');
  assert(create.data.customerId, 'Customer ID returned');
  assert(create.data.customerId.startsWith('cus_mock_'), 'Mock customer ID format');
  assert(create.data.existing === false, 'Not an existing customer');

  // Re-creating returns existing
  const existing = await request('POST', '/payments/create-customer', {}, storeOwnerToken);
  assert(existing.status === 200, 'Existing customer returns 200');
  assert(existing.data.existing === true, 'Recognized as existing');
  assert(existing.data.customerId === create.data.customerId, 'Same customer ID');

  // Create for consumer
  const conCreate = await request('POST', '/payments/create-customer', {}, customerToken);
  assert(conCreate.status === 201 || conCreate.status === 200, 'Consumer customer created');
  assert(conCreate.data.customerId, 'Consumer customer ID returned');

  // Requires auth
  const noAuth = await request('POST', '/payments/create-customer');
  assert(noAuth.status === 401, 'Create customer requires auth');
}

async function testB2BCheckout() {
  console.log('\n🏪 Payments: B2B Checkout');

  // Create checkout session for starter plan
  const checkout = await request('POST', '/payments/b2b/checkout', {
    storeId: testStoreId,
    planId: 'starter',
  }, storeOwnerToken);
  assert(checkout.status === 200, 'B2B checkout returns 200');
  assert(checkout.data.sessionId, 'Session ID returned');
  assert(checkout.data.sessionId.startsWith('cs_mock_'), 'Mock session format');
  assert(checkout.data.url, 'Checkout URL returned');
  assert(checkout.data.subscriptionId, 'Subscription ID returned');
  assert(checkout.data.subscriptionId.startsWith('sub_mock_'), 'Mock subscription format');

  // With inventory add-on
  const withInv = await request('POST', '/payments/b2b/checkout', {
    storeId: testStoreId,
    planId: 'professional',
    inventoryPlanId: 'inventory_pro',
  }, storeOwnerToken);
  assert(withInv.status === 200, 'B2B checkout with inventory add-on');
  assert(withInv.data.sessionId, 'Session ID with add-on');

  // Free plan - no checkout needed
  const free = await request('POST', '/payments/b2b/checkout', {
    storeId: testStoreId,
    planId: 'free',
  }, storeOwnerToken);
  assert(free.status === 200, 'Free plan returns 200');
  assert(free.data.message?.includes('no payment'), 'Free plan needs no payment');

  // Invalid plan
  const badPlan = await request('POST', '/payments/b2b/checkout', {
    storeId: testStoreId,
    planId: 'platinum_diamond',
  }, storeOwnerToken);
  assert(badPlan.status === 400, 'Invalid plan rejected');

  // Missing fields
  const noStore = await request('POST', '/payments/b2b/checkout', { planId: 'starter' }, storeOwnerToken);
  assert(noStore.status === 400, 'Missing storeId rejected');

  // Customer blocked
  const blocked = await request('POST', '/payments/b2b/checkout', {
    storeId: testStoreId, planId: 'starter',
  }, customerToken);
  assert(blocked.status === 403, 'Customer blocked from B2B checkout');
}

async function testConsumerCheckout() {
  console.log('\n🛍️ Payments: Consumer Checkout');

  const checkout = await request('POST', '/payments/consumer/checkout', {
    planId: 'radar_plus',
    billingInterval: 'monthly',
  }, customerToken);
  assert(checkout.status === 200, 'Consumer checkout returns 200');
  assert(checkout.data.sessionId, 'Session ID returned');
  assert(checkout.data.url, 'Checkout URL returned');
  assert(checkout.data.subscriptionId, 'Subscription ID returned');

  // Annual billing
  const annual = await request('POST', '/payments/consumer/checkout', {
    planId: 'radar_pro',
    billingInterval: 'annual',
  }, customerToken);
  assert(annual.status === 200, 'Annual checkout works');

  // Free plan
  const free = await request('POST', '/payments/consumer/checkout', { planId: 'free' }, customerToken);
  assert(free.status === 200, 'Free consumer plan OK');
  assert(free.data.message?.includes('no payment'), 'No payment for free');

  // Invalid plan
  const bad = await request('POST', '/payments/consumer/checkout', { planId: 'ultra' }, customerToken);
  assert(bad.status === 400, 'Invalid consumer plan rejected');

  // Unauthed
  const noAuth = await request('POST', '/payments/consumer/checkout', { planId: 'radar_plus' });
  assert(noAuth.status === 401, 'Consumer checkout requires auth');
}

async function testSessionVerification() {
  console.log('\n🔍 Payments: Session Verification');

  // Create a session first
  const checkout = await request('POST', '/payments/b2b/checkout', {
    storeId: testStoreId, planId: 'starter',
  }, storeOwnerToken);
  const sessionId = checkout.data.sessionId;

  const verify = await request('GET', `/payments/session/${sessionId}`, null, storeOwnerToken);
  assert(verify.status === 200, 'Session verification returns 200');
  assert(verify.data.sessionId === sessionId, 'Correct session returned');
  assert(verify.data.metadata?.type === 'b2b', 'Metadata type is b2b');
  assert(verify.data.metadata?.planId === 'starter', 'Metadata has planId');
  assert(verify.data.subscriptionId, 'Subscription ID in session');

  // Non-existent session
  const bad = await request('GET', '/payments/session/cs_nonexistent', null, storeOwnerToken);
  assert(bad.status === 404, 'Non-existent session returns 404');
}

async function testBillingPortal() {
  console.log('\n🏦 Payments: Billing Portal');

  const portal = await request('POST', '/payments/billing-portal', {
    returnUrl: 'http://localhost:3001/portal',
  }, storeOwnerToken);
  assert(portal.status === 200, 'Billing portal returns 200');
  assert(portal.data.url, 'Portal URL returned');

  // No customer yet for a fresh user
  const freshToken = (await request('POST', '/auth/register', {
    email: 'fresh@test.com', password: 'pw123456', name: 'Fresh', role: 'store_owner',
  })).data.token;
  const noCust = await request('POST', '/payments/billing-portal', {}, freshToken);
  assert(noCust.status === 400, 'No customer = billing portal blocked');
}

async function testPaymentMethods() {
  console.log('\n💳 Payments: Payment Methods');

  const methods = await request('GET', '/payments/payment-methods', null, storeOwnerToken);
  assert(methods.status === 200, 'GET payment methods returns 200');
  assert(Array.isArray(methods.data.paymentMethods), 'Payment methods is array');

  // Fresh user with no customer
  const freshToken = (await request('POST', '/auth/register', {
    email: 'pmtest@test.com', password: 'pw123456', name: 'PM', role: 'customer',
  })).data.token;
  const empty = await request('GET', '/payments/payment-methods', null, freshToken);
  assert(empty.status === 200, 'No customer returns 200');
  assert((empty.data.paymentMethods || []).length === 0, 'Empty array for no customer');
}

async function testInvoices() {
  console.log('\n🧾 Payments: Invoices');

  const invoices = await request('GET', '/payments/invoices', null, storeOwnerToken);
  assert(invoices.status === 200, 'GET invoices returns 200');
  assert(Array.isArray(invoices.data.invoices), 'Invoices is array');
  if (invoices.data.invoices.length > 0) {
    const inv = invoices.data.invoices[0];
    assert(typeof inv.amount === 'number', 'Invoice amount is number');
    assert(inv.currency, 'Invoice has currency');
    assert(inv.status, 'Invoice has status');
    assert(inv.date, 'Invoice has date');
  }
}

async function testWebhook() {
  console.log('\n🔔 Payments: Webhook');

  // Simulate checkout.session.completed webhook
  const webhookPayload = JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_webhook_001',
        customer: 'cus_test_001',
        subscription: 'sub_test_webhook_001',
        metadata: {
          type: 'b2b',
          storeId: testStoreId,
          planId: 'professional',
          userId: 'test-webhook-user',
        },
      },
    },
  });

  const res = await fetch('http://localhost:3001/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'mock_sig' },
    body: webhookPayload,
  });
  const data = await res.json();
  assert(res.status === 200, 'Webhook returns 200');
  assert(data.received === true, 'Webhook acknowledged');

  // Simulate subscription.updated
  const updatePayload = JSON.stringify({
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_test_webhook_001',
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      },
    },
  });

  const update = await fetch('http://localhost:3001/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'mock_sig' },
    body: updatePayload,
  });
  assert(update.status === 200, 'Subscription update webhook OK');

  // Simulate subscription.deleted
  const deletePayload = JSON.stringify({
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_test_webhook_001' } },
  });

  const del = await fetch('http://localhost:3001/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'mock_sig' },
    body: deletePayload,
  });
  assert(del.status === 200, 'Subscription delete webhook OK');

  // Simulate payment failed
  const failPayload = JSON.stringify({
    type: 'invoice.payment_failed',
    data: { object: { id: 'in_test_fail', customer: 'cus_test_001' } },
  });

  const fail = await fetch('http://localhost:3001/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'mock_sig' },
    body: failPayload,
  });
  assert(fail.status === 200, 'Payment failed webhook OK');
}

async function testPaymentDocs() {
  console.log('\n📚 Payments: Documentation');

  const docs = await request('GET', '/docs');
  const endpoints = docs.data.endpoints || [];
  const paymentEndpoints = endpoints.filter(e => e.path?.includes('/payments/'));
  assert(paymentEndpoints.length >= 10, `${paymentEndpoints.length} payment endpoints documented`);
  assert(paymentEndpoints.some(e => e.path.includes('checkout')), 'Checkout documented');
  assert(paymentEndpoints.some(e => e.path.includes('webhook')), 'Webhook documented');
  assert(paymentEndpoints.some(e => e.path.includes('billing-portal')), 'Billing portal documented');
  assert(paymentEndpoints.some(e => e.path.includes('invoices')), 'Invoices documented');
}

async function runAll() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  🧪 Retail Radar v3.1 - Full Test Suite               ║');
  console.log('║  Core + Monetization + Scraper + Extension + Portal   ║');
  console.log('║  + Stripe Payments                                    ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  const app = require('../backend/server');
  // Initialize DB before starting server
  await app.initDb();
  server = app.listen(3001);
  await new Promise(r => setTimeout(r, 200));

  try {
    await testHealth();
    await testAuth();
    await testSearch();
    await testStores();
    await testInventory();
    await testOrders();
    await testNotifications();
    await testB2BPlans();
    await testB2BSubscription();
    await testB2BPromotions();
    await testB2BInsights();
    await testB2BBilling();
    await testB2BCancellation();
    await testConsumerPlans();
    await testConsumerSubscription();
    await testFeeCalculator();
    await testAdPlacements();
    await testConsumerCancel();
    await testScraper();
    await testScraperAPI();
    await testExtensionEndpoints();
    await testDashboardClaim();
    await testDashboardOverview();
    await testDashboardInventoryMgmt();
    await testDashboardOrders();
    await testDashboardAnalytics();
    await testPortalServed();
    await testPaymentConfig();
    await testPaymentCustomer();
    await testB2BCheckout();
    await testConsumerCheckout();
    await testSessionVerification();
    await testBillingPortal();
    await testPaymentMethods();
    await testInvoices();
    await testWebhook();
    await testPaymentDocs();
  } catch (err) {
    console.error('\n💥 Error:', err.message, err.stack);
  }

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log(`║  ✅ Passed: ${String(passed).padEnd(4)} ❌ Failed: ${String(failed).padEnd(4)}              ║`);
  console.log(`║  📊 Total:  ${String(total).padEnd(4)} 📈 Rate:   ${total > 0 ? ((passed/total)*100).toFixed(0) : 0}%               ║`);
  console.log('╚═══════════════════════════════════════════════════════╝');

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
