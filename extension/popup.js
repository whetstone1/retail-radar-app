/**
 * Retail Radar - Popup Controller
 * Manages search, authentication, and results in the extension popup.
 */

(async () => {
  const api = new RetailRadarAPI();
  let currentLocation = null;
  let activeCategory = '';
  let isSignUp = false;

  // DOM refs
  const $ = id => document.getElementById(id);
  const searchInput = $('search-input');
  const searchBtn = $('search-btn');
  const resultsSection = $('results-section');
  const locationText = $('location-text');
  const authBtn = $('auth-btn');
  const authModal = $('auth-modal');
  const membershipBanner = $('membership-banner');

  // ===== INIT =====
  async function init() {
    await detectLocation();
    await updateAuthState();

    // Check if we have a search from the Amazon page
    try {
      const data = await chrome.storage.local.get(['rr_pending_search']);
      if (data.rr_pending_search) {
        searchInput.value = data.rr_pending_search;
        await chrome.storage.local.remove(['rr_pending_search']);
        performSearch();
      }
    } catch (e) {}
  }

  // ===== LOCATION =====
  async function detectLocation() {
    locationText.textContent = 'Detecting location...';
    currentLocation = await api.getLocation();
    const city = currentLocation.city || 'Your Area';
    locationText.textContent = `${city} (${currentLocation.source === 'gps' ? 'GPS' : 'approx'})`;
  }

  // ===== AUTH =====
  async function updateAuthState() {
    await api._loadToken();
    if (api.isLoggedIn()) {
      authBtn.textContent = 'Account';
      authBtn.onclick = showAccountMenu;
      await showMembership();
    } else {
      authBtn.textContent = 'Sign In';
      authBtn.onclick = () => showAuthModal(false);
      membershipBanner.style.display = 'none';
    }
  }

  function showAuthModal(signUp) {
    isSignUp = signUp;
    $('modal-title').textContent = signUp ? 'Create Account' : 'Sign In';
    $('auth-name').style.display = signUp ? 'block' : 'none';
    $('modal-submit').textContent = signUp ? 'Create Account' : 'Sign In';
    $('modal-toggle').textContent = signUp
      ? 'Already have an account? Sign in'
      : "Don't have an account? Sign up";
    $('modal-error').style.display = 'none';
    authModal.classList.add('active');
  }

  $('modal-toggle').onclick = () => showAuthModal(!isSignUp);
  $('modal-close').onclick = () => authModal.classList.remove('active');

  $('modal-submit').onclick = async () => {
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    const name = $('auth-name').value.trim();
    const errorEl = $('modal-error');

    if (!email || !password) {
      errorEl.textContent = 'Please fill in all fields.';
      errorEl.style.display = 'block';
      return;
    }

    $('modal-submit').textContent = 'Loading...';
    $('modal-submit').disabled = true;

    let res;
    if (isSignUp) {
      res = await api.register(email, password, name || 'User');
    } else {
      res = await api.login(email, password);
    }

    $('modal-submit').disabled = false;

    if (res.data.token) {
      authModal.classList.remove('active');
      await updateAuthState();
    } else {
      errorEl.textContent = res.data.error || 'Authentication failed.';
      errorEl.style.display = 'block';
      $('modal-submit').textContent = isSignUp ? 'Create Account' : 'Sign In';
    }
  };

  function showAccountMenu() {
    const choice = confirm('Sign out of Retail Radar?');
    if (choice) {
      api.logout();
      updateAuthState();
    }
  }

  async function showMembership() {
    const res = await api.getMembership();
    const plan = res.data?.plan;
    if (!plan) return;

    membershipBanner.style.display = 'flex';
    $('plan-name').textContent = plan.name || 'Free';

    if (plan.id === 'free') {
      $('plan-perk').textContent = 'Upgrade for free delivery';
      $('upgrade-btn').style.display = 'inline-block';
      $('upgrade-btn').onclick = () => {
        window.open('http://localhost:3001/#pricing', '_blank');
      };
    } else {
      $('plan-perk').textContent = plan.id === 'radar_pro' ? 'Free delivery on all orders' : 'Free delivery on $15+';
      $('upgrade-btn').style.display = plan.id === 'radar_pro' ? 'none' : 'inline-block';
    }
  }

  // ===== SEARCH =====
  async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    if (!currentLocation) await detectLocation();

    // Show loading
    resultsSection.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Searching local stores...</p>
      </div>
    `;

    const res = await api.search(query, currentLocation.lat, currentLocation.lng, {
      category: activeCategory || undefined,
      radius: 15,
      sortBy: 'distance',
      limit: 10,
    });

    if (res.status === 0) {
      resultsSection.innerHTML = `
        <div class="empty-state">
          <div class="emoji">⚠️</div>
          <p>Could not connect to Retail Radar server.<br>Make sure the server is running on localhost:3001.</p>
        </div>
      `;
      return;
    }

    const results = res.data?.results || [];

    if (results.length === 0) {
      resultsSection.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🔍</div>
          <p>No local results for "${query}".<br>Try a broader search term.</p>
        </div>
      `;
      return;
    }

    // Update badge
    try {
      chrome.runtime.sendMessage({ type: 'updateBadge', count: results.length });
    } catch (e) {}

    renderResults(results, query);
  }

  function renderResults(results, query) {
    const html = `
      <div class="results-header">
        <span>${results.length} results for "${query}"</span>
        <span>Sort: Distance</span>
      </div>
      ${results.map(r => {
        const store = r.nearestStore || {};
        const dist = store.distance ? store.distance.toFixed(1) : '?';
        const delivery = store.deliveryEstimate?.delivery || '25-35 min';
        return `
          <div class="result-card" data-name="${encodeURIComponent(r.name)}">
            <div class="result-name">${r.name}</div>
            <div class="result-store">📍 ${store.storeName || 'Local Store'} · ${dist} mi</div>
            <div class="result-meta">
              <div class="result-price">$${r.bestPrice.toFixed(2)}</div>
              <div class="result-info">
                <div class="result-delivery">🚚 ${delivery}</div>
              </div>
            </div>
            <div class="result-actions">
              <button class="result-btn btn-delivery" data-action="delivery" data-query="${encodeURIComponent(r.name)}">🚚 Delivery</button>
              <button class="result-btn btn-pickup" data-action="pickup" data-query="${encodeURIComponent(r.name)}">🏪 Pickup</button>
            </div>
          </div>
        `;
      }).join('')}
    `;

    resultsSection.innerHTML = html;

    // Click handlers for result buttons
    resultsSection.querySelectorAll('.result-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const q = decodeURIComponent(btn.dataset.query);
        const action = btn.dataset.action;
        window.open(
          `http://localhost:3001/?search=${encodeURIComponent(q)}&fulfillment=${action}`,
          '_blank'
        );
      });
    });

    // Click handler for result cards
    resultsSection.querySelectorAll('.result-card').forEach(card => {
      card.addEventListener('click', () => {
        const name = decodeURIComponent(card.dataset.name);
        window.open(`http://localhost:3001/?search=${encodeURIComponent(name)}`, '_blank');
      });
    });
  }

  // ===== EVENT LISTENERS =====

  // Search
  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  // Category filters
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.cat;
      if (searchInput.value.trim()) performSearch();
    });
  });

  // Location change
  $('change-location').addEventListener('click', () => {
    const zip = prompt('Enter your zip code or city:');
    if (zip) {
      locationText.textContent = `${zip} (manual)`;
    }
  });

  // Auth button
  authBtn.addEventListener('click', () => {
    if (api.isLoggedIn()) showAccountMenu();
    else showAuthModal(false);
  });

  // Init
  init();
})();
