# Nov 5–6 Stock Tracker

Mobile-friendly mark-to-market page for Weston's Nov 5–6, 2026 buys.

## Live site

**GitHub Pages (live now):** https://westonwhite.github.io/stock-tracker/

Tap **Refresh** (also auto-loads on open). No background polling.
Prices come from TradingView’s public scanner when hosted on Pages.
When deployed as a Cloudflare Worker, `/api/quotes` proxies Yahoo Finance (CNBC fallback).

## Edit positions

One array near the top of `index.html` / `public/index.html`:

```js
const POSITIONS = [
  { ticker: "SNDK", shares: 7, avgCost: 839.19, totalCost: 5874.36, tv: "NASDAQ:SNDK" },
  ...
];
```

## Cloudflare Worker

```bash
cd /workspace/stock-tracker
npx wrangler deploy
```

Uses account `62c5bccd307ce0dc53b6330558dec4a3` when logged in. Does not touch other Workers.

Cloudflare OAuth on this box expired 2026-10-30; GitHub Pages is the lasting public URL until `wrangler login` is refreshed.
