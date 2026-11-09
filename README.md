# Nov 5–6 Stock Tracker

Mobile-friendly mark-to-market page for Weston's Nov 5–6, 2026 buys.

## Positions

Edit the `POSITIONS` array near the top of `index.html` (and the matching array in `src/index.js` if using the Worker quote proxy).

## Live site (GitHub Pages)

https://westonwhite.github.io/stock-tracker/

Refresh pulls live prices from TradingView's public scanner (CORS-friendly). No background polling.

## Cloudflare Worker (preferred when auth works)

```bash
cd /workspace/stock-tracker
npx wrangler deploy
```

Worker serves the same UI and `/api/quotes` (Yahoo Finance chart API, CNBC fallback).

Account: `62c5bccd307ce0dc53b6330558dec4a3` (same as tesla-fleet). Does not modify other Workers.

## Note

Cloudflare OAuth on this box expired (2026-10-30). Until `wrangler login` is refreshed, use the GitHub Pages URL above.
