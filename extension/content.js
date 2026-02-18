/**
 * Retail Radar - Content Script
 * Injected into Amazon product pages.
 * 
 * Detects: Product name, price, category from the Amazon page.
 * Shows: A floating overlay with local alternatives, price comparison,
 *        delivery estimates, and a CTA to buy local.
 */

(() => {
  const API_BASE = 'http://localhost:3001/api';
  let currentOverlay = null;

  // ===== AMAZON PAGE PARSER =====
  
  function parseAmazonProduct() {
    const product = {};

    // Product title
    product.name = (
      document.getElementById('productTitle')?.textContent?.trim() ||
      document.querySelector('[data-automation-id="title"]')?.textContent?.trim() ||
      document.querySelector('h1 span')?.textContent?.trim() ||
      ''
    );

    // Price
    const priceEl = document.querySelector('.a-price .a-offscreen') ||
                    document.querySelector('#priceblock_ourprice') ||
                    document.querySelector('#priceblock_dealprice') ||
                    document.querySelector('.a-price-whole');
    if (priceEl) {
      const raw = priceEl.textContent.trim().replace(/[^0-9.]/g, '');
      product.price = parseFloat(raw) || 0;
    }

    // Category from breadcrumbs
    const breadcrumbs = document.querySelectorAll('#wayfinding-breadcrumbs_feature_div a, .a-breadcrumb a');
    if (breadcrumbs.length > 0) {
      product.category = breadcrumbs[breadcrumbs.length - 1]?.textContent?.trim() || '';
    }

    // Delivery estimate
    const deliveryEl = document.querySelector('#mir-layout-DELIVERY_BLOCK .a-text-bold') ||
                       document.querySelector('#delivery-message .a-text-bold');
    product.amazonDelivery = deliveryEl?.textContent?.trim() || '';

    // Image
    product.imageUrl = document.querySelector('#landingImage, #imgBlkFront')?.src || '';

    // Search query (simplified product name for search)
    product.searchQuery = product.name
      .replace(/\([^)]*\)/g, '')       // Remove parenthetical
      .replace(/\d+\s*(pack|count|pcs?|set)/gi, '') // Remove pack sizes
      .replace(/[^\w\s-]/g, '')        // Remove special chars
      .trim()
      .split(' ')
      .slice(0, 5)                     // First 5 words
      .join(' ');

    return product;
  }

  // ===== API CALLS =====

  async function getLocation() {
    try {
      const stored = await chrome.storage.local.get(['rr_location']);
      if (stored.rr_location) return JSON.parse(stored.rr_location);
    } catch (e) {}
    
    // IP fallback
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      const loc = { lat: data.latitude, lng: data.longitude, city: data.city };
      try { await chrome.storage.local.set({ rr_location: JSON.stringify(loc) }); } catch(e) {}
      return loc;
    } catch (e) {
      return { lat: 40.6892, lng: -73.9857, city: 'Brooklyn' };
    }
  }

  async function searchLocalAlternatives(query, lat, lng) {
    try {
      const token = (await chrome.storage.local.get(['rr_token'])).rr_token;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query, lat, lng, radius: 15, sortBy: 'distance', limit: 10,
        }),
      });
      return await res.json();
    } catch (err) {
      return { error: 'Could not connect to Retail Radar', results: [] };
    }
  }

  // ===== OVERLAY UI =====

  function createOverlay(amazonProduct, results, location) {
    // Remove existing overlay
    if (currentOverlay) currentOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'retail-radar-overlay';
    overlay.className = 'rr-overlay';

    const totalResults = results.length;
    const bestResult = results[0];
    const savings = bestResult && amazonProduct.price
      ? ((amazonProduct.price - bestResult.bestPrice) / amazonProduct.price * 100).toFixed(0)
      : null;

    overlay.innerHTML = `
      <div class="rr-header">
        <div class="rr-logo">
          <span class="rr-logo-icon">R</span>
          <span class="rr-logo-text">Shop local,<br>from home.</span>
        </div>
        <button class="rr-close" id="rr-close">×</button>
      </div>

      <div class="rr-title">
        Retail Radar Found ${totalResults} Similar Items Near You!
      </div>

      ${totalResults === 0 ? `
        <div class="rr-no-results">
          <p>No local matches found for this product.</p>
          <p class="rr-hint">Try searching in the Retail Radar popup for more options.</p>
        </div>
      ` : `
        <div class="rr-results-scroll">
          ${results.slice(0, 5).map((r, i) => `
            <div class="rr-result ${i === 0 ? 'rr-best' : ''}" data-idx="${i}">
              <div class="rr-result-name">${r.name}</div>
              <div class="rr-result-store">${r.nearestStore?.storeName || 'Local Store'}</div>
              <div class="rr-result-details">
                <span class="rr-result-price">$${r.bestPrice.toFixed(2)}</span>
                <span class="rr-result-distance">${r.nearestStore?.distance ? r.nearestStore.distance.toFixed(1) + ' mi' : ''}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="rr-comparison">
          <div class="rr-our-price">
            <div class="rr-price-label">Our Best Price:</div>
            <div class="rr-price-value">
              ${savings && savings > 0 ? `<span class="rr-savings">-${savings}%</span>` : ''}
              $${bestResult.bestPrice.toFixed(2)}
            </div>
            <div class="rr-amazon-price">(Amazon: $${amazonProduct.price ? amazonProduct.price.toFixed(2) : '?.??'})</div>
          </div>

          <div class="rr-delivery-time">
            <div class="rr-price-label">Estimated Delivery:</div>
            <div class="rr-delivery-value">
              ${bestResult.nearestStore?.deliveryEstimate?.delivery || '25-35 min'}
            </div>
            <div class="rr-amazon-delivery">(Amazon: ${amazonProduct.amazonDelivery || '2-5 Days'})</div>
          </div>
        </div>

        <div class="rr-cta-text">Support a local business!</div>
        <div class="rr-buttons">
          <button class="rr-btn rr-btn-delivery" id="rr-delivery-btn">Delivery</button>
          <button class="rr-btn rr-btn-pickup" id="rr-pickup-btn">Pickup</button>
        </div>
      `}

      <div class="rr-footer">
        <span class="rr-location">📍 ${location.city || 'Your Area'}</span>
        <a href="#" class="rr-powered" id="rr-open-popup">Powered by Retail Radar</a>
      </div>
    `;

    document.body.appendChild(overlay);
    currentOverlay = overlay;

    // Event listeners
    overlay.querySelector('#rr-close')?.addEventListener('click', () => {
      overlay.classList.add('rr-closing');
      setTimeout(() => overlay.remove(), 300);
    });

    overlay.querySelector('#rr-delivery-btn')?.addEventListener('click', () => {
      // In production: open order flow in new tab
      window.open(`http://localhost:3001/?search=${encodeURIComponent(amazonProduct.searchQuery)}&fulfillment=delivery`, '_blank');
    });

    overlay.querySelector('#rr-pickup-btn')?.addEventListener('click', () => {
      window.open(`http://localhost:3001/?search=${encodeURIComponent(amazonProduct.searchQuery)}&fulfillment=pickup`, '_blank');
    });

    // Click on individual results
    overlay.querySelectorAll('.rr-result').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        const result = results[idx];
        if (result) {
          window.open(`http://localhost:3001/?search=${encodeURIComponent(result.name)}`, '_blank');
        }
      });
    });
  }

  // ===== INIT =====

  async function init() {
    // Only run on Amazon product pages
    if (!window.location.href.includes('/dp/') && !window.location.href.includes('/gp/product/')) {
      return;
    }

    // Small delay to let Amazon page fully load
    await new Promise(r => setTimeout(r, 1500));

    const product = parseAmazonProduct();
    if (!product.name || !product.searchQuery) return;

    const location = await getLocation();
    const searchResults = await searchLocalAlternatives(product.searchQuery, location.lat, location.lng);

    if (searchResults.results && searchResults.results.length > 0) {
      createOverlay(product, searchResults.results, location);
    } else {
      // Still show overlay but with "no results"
      createOverlay(product, [], location);
    }
  }

  // Run
  init();

  // Also re-run on URL changes (Amazon uses SPA-like navigation)
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (currentOverlay) currentOverlay.remove();
      setTimeout(init, 2000);
    }
  }).observe(document.body, { childList: true, subtree: true });

})();
