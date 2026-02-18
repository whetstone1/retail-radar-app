module.exports = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'rr-dev-secret-change-in-production-2024',
  jwtExpiry: '7d',
  bcryptRounds: 10,
  maxRadius: 50, // miles
  defaultRadius: 10,
  defaultLocation: { lat: 40.6892, lng: -73.9857 }, // Brooklyn
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 10000 : 500
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100
  }
};
