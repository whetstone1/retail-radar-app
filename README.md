# 🔴 Retail Radar™

**Shop local, from home.**

A search engine for local retail that helps consumers find products at nearby stores with faster delivery times and competitive pricing vs Amazon.

## What It Does

- **Chrome Extension** — Pops up on Amazon product pages showing cheaper/faster local alternatives
- **Website** — Amazon-like shopping experience sourced entirely from local retailers
- **Store Owner Portal** — Dashboard for retailers to manage inventory, orders, and analytics
- **B2B + Consumer Monetization** — Subscription tiers, promoted listings, delivery fees, premium memberships

## Tech Stack

- **Backend**: Node.js + Express + SQLite (sql.js)
- **Frontend**: Vanilla HTML/CSS/JS (mobile-first)
- **Chrome Extension**: Manifest V3
- **Payments**: Stripe integration
- **Database**: 15 retailers, 300+ stores, 500+ products, ~28k inventory records across 22 US cities

## Quick Start

```bash
# Install dependencies
cd backend && npm install

# Start the server (auto-seeds database on first run)
node server.js

# Server runs on http://localhost:3000
# Store portal at http://localhost:3000/portal
```

## Run Tests

```bash
node tests/run-tests.js
# 294 tests, 100% passing
```

## Project Structure

```
retail-radar-app/
├── backend/
│   ├── server.js          # Express app + startup
│   ├── config.js           # Environment configuration
│   ├── models/database.js  # Data layer + seed logic
│   ├── db/
│   │   ├── sqlite.js       # SQLite persistence
│   │   └── queries.js      # SQL query layer
│   ├── data/catalog.js     # Product/store catalog (500+ items)
│   ├── routes/             # API routes
│   ├── middleware/          # Auth, validation, rate limiting
│   └── scraper/            # Web scraper for live inventory
├── frontend/               # Consumer website
├── extension/              # Chrome extension (Manifest V3)
├── portal/                 # Store owner dashboard
└── tests/run-tests.js      # Full test suite
```

## API Highlights

| Endpoint | Description |
|---|---|
| `POST /api/search` | Search products by keyword + location |
| `GET /api/stores/nearby` | Find stores by lat/lng + radius |
| `GET /api/search/categories` | Browse product categories |
| `POST /api/orders` | Place an order |
| `GET /api/dashboard/overview/:storeId` | Store owner dashboard |
| `POST /api/payments/checkout` | Stripe checkout session |

Full API docs at `GET /api/docs` when server is running.

## Retailers

Home Depot, Lowe's, Target, Walmart, Best Buy, CVS, Walgreens, Ace Hardware, Staples, IKEA, Costco, Whole Foods, Trader Joe's, Dollar General, Menards

## Cities

NYC (Brooklyn, Manhattan, Queens, Bronx), Jersey City, LA, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, San Francisco, Austin, Miami, DC, Atlanta, Seattle, Boston, Denver, Portland

## License

Proprietary — Retail Radar™ © 2024
