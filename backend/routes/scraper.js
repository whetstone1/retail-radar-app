/**
 * Scraper API Routes
 * Trigger and manage web scraping jobs.
 * Admin-only endpoints.
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ScraperRunner = require('../../scraper');
const db = require('../models/database');

// Track running jobs
const scraperJobs = [];

// POST /api/scraper/run - Trigger a scraping job
router.post('/run', authenticate, authorize('admin', 'store_owner'), async (req, res) => {
  const { lat, lng, radius, retailer, products, allMetros } = req.body;

  const jobId = `scrape-${Date.now()}`;
  const job = {
    id: jobId,
    status: 'running',
    startedAt: new Date().toISOString(),
    config: { lat, lng, radius, retailer, products, allMetros },
    results: null,
  };
  scraperJobs.push(job);

  // Respond immediately, run scraping in background
  res.status(202).json({
    message: 'Scraping job started',
    jobId,
    status: 'running',
    checkStatusAt: `/api/scraper/jobs/${jobId}`,
  });

  // Run scraper
  try {
    const runner = new ScraperRunner({
      lat: lat || 40.6892,
      lng: lng || -73.9857,
      radius: radius || 25,
      retailer,
      products: products || false,
      allMetros: allMetros || false,
    });

    const results = await runner.run();
    const ingestion = runner.ingestIntoDatabase(db);

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.results = {
      storesScraped: results.stores.length,
      productsScraped: results.products.length,
      errors: results.errors.length,
      ingestion,
    };
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    job.completedAt = new Date().toISOString();
  }
});

// GET /api/scraper/jobs - List scraping jobs
router.get('/jobs', authenticate, authorize('admin', 'store_owner'), (req, res) => {
  res.json({ jobs: scraperJobs.slice(-20).reverse() });
});

// GET /api/scraper/jobs/:id - Check job status
router.get('/jobs/:id', authenticate, authorize('admin', 'store_owner'), (req, res) => {
  const job = scraperJobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// GET /api/scraper/retailers - List available retailers to scrape
router.get('/retailers', (req, res) => {
  res.json({
    retailers: [
      { key: 'homedepot', name: 'Home Depot', storeLocator: true, productSearch: true },
      { key: 'lowes', name: "Lowe's", storeLocator: true, productSearch: true },
      { key: 'bestbuy', name: 'Best Buy', storeLocator: true, productSearch: true },
      { key: 'target', name: 'Target', storeLocator: true, productSearch: false },
      { key: 'walmart', name: 'Walmart', storeLocator: true, productSearch: false },
      { key: 'cvs', name: 'CVS Pharmacy', storeLocator: true, productSearch: false },
      { key: 'acehardware', name: 'Ace Hardware', storeLocator: true, productSearch: false },
    ],
  });
});

module.exports = router;
