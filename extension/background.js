/**
 * Retail Radar - Background Service Worker
 * Handles: extension install, location caching, badge updates
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      rr_settings: {
        autoShow: true,       // Auto-show overlay on Amazon
        radius: 15,           // Default search radius (miles)
        notifications: true,  // Price drop notifications
      }
    });
    console.log('Retail Radar installed!');
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getSettings') {
    chrome.storage.local.get(['rr_settings'], (data) => {
      sendResponse(data.rr_settings || { autoShow: true, radius: 15 });
    });
    return true; // async
  }

  if (msg.type === 'updateBadge') {
    const count = msg.count || 0;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#E53935' });
  }
});
