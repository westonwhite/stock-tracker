# Nov 5–6 Stock Tracker

Mobile-friendly mark-to-market page for Weston's Nov 5–6, 2026 buys.

## Live site (lasting)

**https://westonwhite.github.io/stock-tracker/**

- Opens with live prices; tap **Refresh** to mark to market again
- No background polling / routines
- Sorted by % return vs cost; green/red P&L
- Opens and Refresh pull live prices from TradingView (text/plain so CORS preflight succeeds), with a CNBC fallback.
- `prices.json` is only a snapshot fallback, not the primary refresh source

Repo: https://github.com/westonwhite/stock-tracker

An optional GitHub Action (`.github/workflows/refresh-prices.yml` in the working copy, also saved as `refresh-prices.workflow.yml.txt`) can refresh `prices.json` every 15 minutes during market hours. Enabling it requires a token with the `workflow` scope; the live page does not depend on it.

## Edit positions

One array near the top of `index.html` / `public/index.html`:

```js
const POSITIONS = [
  { ticker: "SNDK", shares: 7, avgCost: 839.19, totalCost: 5874.36, tv: "NASDAQ:SNDK" },
  // ...
];
```

## Cloudflare Worker (preferred when auth works)

Source: `src/index.js` + `public/` assets + `wrangler.toml`

```bash
cd /workspace/stock-tracker
npx wrangler login   # OAuth on this box expired 2026-10-30
npx wrangler deploy  # deploys as stock-tracker on workers.dev; does not touch other Workers
```

Worker serves the same UI and `/api/quotes` (Yahoo Finance chart API, CNBC fallback).
Account id in config: `62c5bccd307ce0dc53b6330558dec4a3` (same as tesla-fleet) — add `account_id` back to wrangler.toml after login if needed.
