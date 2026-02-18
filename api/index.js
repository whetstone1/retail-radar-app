/**
 * Vercel Serverless Entry Point
 * Wraps the Express app for Vercel's serverless functions.
 * DB initializes once per cold start (~0.2s), then stays warm.
 */

const app = require('../backend/server');
const db = require('../backend/models/database');

let initialized = false;

module.exports = async (req, res) => {
  if (!initialized) {
    await db.init();
    initialized = true;
  }
  return app(req, res);
};
