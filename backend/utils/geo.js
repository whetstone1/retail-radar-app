/**
 * Geolocation utilities for distance calculation and proximity search.
 * Structured for migration to PostGIS.
 */

function toRadians(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Haversine distance between two lat/lng points (miles)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

/**
 * Bounding box filter for quick pre-filtering before precise distance calc.
 * Returns {minLat, maxLat, minLng, maxLng}
 */
function getBoundingBox(lat, lng, radiusMiles) {
  const latDelta = radiusMiles / 69.0;
  const lngDelta = radiusMiles / (69.0 * Math.cos(toRadians(lat)));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta
  };
}

/**
 * Find stores within radius of a point.
 */
function findNearbyStores(stores, lat, lng, radiusMiles) {
  const box = getBoundingBox(lat, lng, radiusMiles);
  return stores
    .filter(s => s.lat >= box.minLat && s.lat <= box.maxLat && s.lng >= box.minLng && s.lng <= box.maxLng)
    .map(s => ({ ...s, distance: calculateDistance(lat, lng, s.lat, s.lng) }))
    .filter(s => s.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Estimate delivery/drive time based on distance (simple heuristic).
 */
function estimateDeliveryTime(distanceMiles) {
  if (distanceMiles <= 2) return { pickup: '10-15 min', delivery: '15-25 min' };
  if (distanceMiles <= 5) return { pickup: '15-25 min', delivery: '25-35 min' };
  if (distanceMiles <= 10) return { pickup: '20-30 min', delivery: '35-50 min' };
  if (distanceMiles <= 20) return { pickup: '30-45 min', delivery: '50-75 min' };
  return { pickup: '45-60 min', delivery: '75-90 min' };
}

module.exports = {
  calculateDistance,
  getBoundingBox,
  findNearbyStores,
  estimateDeliveryTime
};
