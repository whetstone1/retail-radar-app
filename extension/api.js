/**
 * Retail Radar API Client
 * Connects the Chrome extension to the backend.
 */

const API_BASE = 'http://localhost:3001/api';

class RetailRadarAPI {
  constructor() {
    this.token = null;
    this.userPlan = 'free';
    this._loadToken();
  }

  async _loadToken() {
    try {
      const data = await chrome.storage.local.get(['rr_token', 'rr_plan']);
      this.token = data.rr_token || null;
      this.userPlan = data.rr_plan || 'free';
    } catch (e) {}
  }

  async _saveToken(token, plan) {
    this.token = token;
    this.userPlan = plan || 'free';
    try {
      await chrome.storage.local.set({ rr_token: token, rr_plan: plan });
    } catch (e) {}
  }

  async _request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (this.token) opts.headers['Authorization'] = `Bearer ${this.token}`;
    if (body) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(`${API_BASE}${path}`, opts);
      return { status: res.status, data: await res.json() };
    } catch (err) {
      return { status: 0, data: { error: 'Could not connect to Retail Radar. Is the server running?' } };
    }
  }

  // ===== Auth =====
  async register(email, password, name) {
    const res = await this._request('POST', '/auth/register', { email, password, name });
    if (res.data.token) await this._saveToken(res.data.token, 'free');
    return res;
  }

  async login(email, password) {
    const res = await this._request('POST', '/auth/login', { email, password });
    if (res.data.token) {
      // Check membership
      const mem = await this._request('GET', '/monetization/consumer/membership');
      const plan = mem.data?.plan?.id || 'free';
      await this._saveToken(res.data.token, plan);
    }
    return res;
  }

  async logout() {
    this.token = null;
    this.userPlan = 'free';
    await chrome.storage.local.remove(['rr_token', 'rr_plan', 'rr_location']);
  }

  isLoggedIn() { return !!this.token; }

  // ===== Search =====
  async search(query, lat, lng, options = {}) {
    return this._request('POST', '/search', {
      query,
      lat, lng,
      radius: options.radius || 15,
      category: options.category,
      minPrice: options.minPrice,
      maxPrice: options.maxPrice,
      sortBy: options.sortBy || 'distance',
      limit: options.limit || 10,
    });
  }

  // ===== Fees =====
  async calculateFees(subtotal, fulfillment) {
    return this._request('POST', '/monetization/consumer/calculate-fees', { subtotal, fulfillment });
  }

  // ===== Location =====
  async detectLocation() {
    try {
      // Try browser geolocation first
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' };
    } catch (e) {
      // Fallback to IP-based
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        return { lat: data.latitude, lng: data.longitude, city: data.city, source: 'ip' };
      } catch (e2) {
        // Default to Brooklyn
        return { lat: 40.6892, lng: -73.9857, city: 'Brooklyn', source: 'default' };
      }
    }
  }

  async getLocation() {
    try {
      const stored = await chrome.storage.local.get(['rr_location']);
      if (stored.rr_location) return JSON.parse(stored.rr_location);
    } catch (e) {}

    const loc = await this.detectLocation();
    try {
      await chrome.storage.local.set({ rr_location: JSON.stringify(loc) });
    } catch (e) {}
    return loc;
  }

  // ===== Membership =====
  async getMembership() {
    if (!this.token) return { data: { plan: { id: 'free', name: 'Free' } } };
    return this._request('GET', '/monetization/consumer/membership');
  }

  async getPlans() {
    return this._request('GET', '/monetization/consumer/plans');
  }
}

// Export as global for use in popup and content scripts
if (typeof window !== 'undefined') {
  window.RetailRadarAPI = RetailRadarAPI;
}
