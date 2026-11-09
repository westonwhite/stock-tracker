/**
 * stock-tracker Cloudflare Worker
 * Serves the tracker UI and proxies live quotes (Yahoo first, CNBC fallback).
 * Edit POSITIONS in index.html (or the embedded copy below stays in sync via build).
 */

const POSITIONS = [
  { ticker: "SNDK", shares: 7,  avgCost: 839.19, totalCost: 5874.36 },
  { ticker: "OKTA", shares: 25, avgCost: 169.90, totalCost: 4247.54 },
  { ticker: "DELL", shares: 5,  avgCost: 331.44, totalCost: 1657.18 },
  { ticker: "MRNA", shares: 6,  avgCost: 242.32, totalCost: 1453.93 },
  { ticker: "TWST", shares: 8,  avgCost: 120.59, totalCost: 964.74 },
  { ticker: "TER",  shares: 4,  avgCost: 220.77, totalCost: 883.08 },
  { ticker: "NKE",  shares: 15, avgCost: 38.62,  totalCost: 579.24 },
  { ticker: "TSLA", shares: 5,  avgCost: 383.13, totalCost: 1915.66 },
];

const HTML_URL = new URL("../index.html", import.meta.url); // bundler may inline; we embed at deploy time

async function yahooQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; stock-tracker/1.0)",
      Accept: "application/json",
    },
  });
  if (!r.ok) throw new Error(`Yahoo ${ticker} ${r.status}`);
  const d = await r.json();
  const m = d?.chart?.result?.[0]?.meta;
  if (!m?.regularMarketPrice) throw new Error(`Yahoo ${ticker} empty`);
  const price = Number(m.regularMarketPrice);
  const prev = Number(m.chartPreviousClose ?? m.previousClose ?? price);
  const dayChange = price - prev;
  const dayChangePct = prev ? (dayChange / prev) * 100 : 0;
  return {
    price,
    dayChange,
    dayChangePct,
    name: m.shortName || m.symbol || ticker,
    source: "yahoo",
  };
}

async function cnbcQuote(ticker) {
  const url =
    "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol" +
    `?symbols=${encodeURIComponent(ticker)}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; stock-tracker/1.0)", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`CNBC ${ticker} ${r.status}`);
  const d = await r.json();
  const q = d?.FormattedQuoteResult?.FormattedQuote?.[0];
  if (!q?.last) throw new Error(`CNBC ${ticker} empty`);
  const price = Number(String(q.last).replace(/,/g, ""));
  const dayChange = Number(String(q.change || "0").replace(/,/g, ""));
  const dayChangePct = Number(String(q.change_pct || q.pctchg || "0").replace(/[%+,]/g, ""));
  return {
    price,
    dayChange,
    dayChangePct,
    name: q.name || ticker,
    source: "cnbc",
  };
}

async function quoteOne(ticker) {
  try {
    return await yahooQuote(ticker);
  } catch (e1) {
    try {
      return await cnbcQuote(ticker);
    } catch (e2) {
      return { error: `${e1.message}; ${e2.message}` };
    }
  }
}

async function allQuotes() {
  const entries = await Promise.all(
    POSITIONS.map(async (p) => [p.ticker, await quoteOne(p.ticker)])
  );
  return Object.fromEntries(entries);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/quotes") {
      try {
        const quotes = await allQuotes();
        return new Response(JSON.stringify({ quotes, asOf: new Date().toISOString() }), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "access-control-allow-origin": "*",
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 502,
          headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
        });
      }
    }

    // Serve UI from ASSETS binding if present, else fetch embedded companion.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Fallback: redirect browsers hitting the worker root to keep a single HTML source of truth.
    // When deploying without Assets, paste index.html response here.
    const html = await getHtml();
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  },
};

async function getHtml() {
  // Filled by deploy script / kept in sync with /workspace/stock-tracker/index.html
  // For wrangler without assets, we read from the module's companion via global.
  if (globalThis.__STOCK_TRACKER_HTML__) return globalThis.__STOCK_TRACKER_HTML__;
  return `<!doctype html><meta charset=utf-8><title>Stock Tracker</title>
  <p>Deploy with index.html alongside this Worker (see README).</p>`;
}

globalThis.__STOCK_TRACKER_HTML__ = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8"/>\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>\n<meta name="theme-color" content="#0b1220"/>\n<title>Nov 5–6 Stock Tracker</title>\n<style>\n  :root {\n    --bg:#0b1220; --card:#141c2e; --card2:#1a2438; --text:#eef2ff; --muted:#93a0b8;\n    --green:#22c55e; --green-bg:rgba(34,197,94,.12); --red:#ef4444; --red-bg:rgba(239,68,68,.12);\n    --line:#243049; --accent:#3b82f6; --shadow:0 8px 28px rgba(0,0,0,.35);\n  }\n  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}\n  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}\n  body{min-height:100dvh;padding:16px 14px 40px}\n  .wrap{max-width:720px;margin:0 auto}\n  header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}\n  h1{font-size:1.15rem;margin:0;font-weight:700;letter-spacing:.2px}\n  .sub{color:var(--muted);font-size:.78rem;margin-top:4px}\n  button#refresh{\n    appearance:none;border:0;background:var(--accent);color:white;font-weight:700;\n    padding:12px 16px;border-radius:12px;font-size:.95rem;cursor:pointer;\n    box-shadow:0 4px 14px rgba(59,130,246,.35);min-width:108px;\n  }\n  button#refresh:disabled{opacity:.55;cursor:wait}\n  button#refresh:active{transform:scale(.97)}\n  .totals{\n    background:linear-gradient(160deg,var(--card),var(--card2));\n    border:1px solid var(--line);border-radius:18px;padding:18px 16px;box-shadow:var(--shadow);margin-bottom:14px;\n  }\n  .totals .label{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}\n  .totals .value{font-size:2rem;font-weight:800;margin:4px 0 10px;letter-spacing:-.5px}\n  .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}\n  .stat{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:12px;padding:10px}\n  .stat .k{color:var(--muted);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em}\n  .stat .v{font-size:1rem;font-weight:700;margin-top:3px}\n  .up{color:var(--green)} .down{color:var(--red)} .flat{color:var(--muted)}\n  .meta{color:var(--muted);font-size:.75rem;margin:10px 2px 0;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}\n  .list{display:flex;flex-direction:column;gap:10px}\n  .card{\n    background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;\n    display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center;\n  }\n  .ticker{font-size:1.05rem;font-weight:800;letter-spacing:.3px}\n  .name{color:var(--muted);font-size:.72rem;margin-top:2px}\n  .price{font-size:1.05rem;font-weight:700;text-align:right}\n  .day{font-size:.78rem;text-align:right;margin-top:2px}\n  .pill{\n    display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;\n    font-size:.78rem;font-weight:700;white-space:nowrap;\n  }\n  .pill.up{background:var(--green-bg);color:var(--green)}\n  .pill.down{background:var(--red-bg);color:var(--red)}\n  .details{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding-top:8px;border-top:1px solid var(--line);margin-top:2px}\n  .details .k{color:var(--muted);font-size:.65rem;text-transform:uppercase}\n  .details .v{font-size:.85rem;font-weight:600;margin-top:2px}\n  .err{background:var(--red-bg);color:#fecaca;border:1px solid rgba(239,68,68,.35);padding:12px;border-radius:12px;margin-bottom:12px;font-size:.9rem}\n  .hint{color:var(--muted);font-size:.72rem;text-align:center;margin-top:18px;line-height:1.4}\n  @media (max-width:420px){\n    .totals .value{font-size:1.7rem}\n    .row3{grid-template-columns:1fr; }\n  }\n</style>\n</head>\n<body>\n<div class="wrap">\n  <header>\n    <div>\n      <h1>Nov 5–6 buys</h1>\n      <div class="sub">Tap Refresh to mark to market</div>\n    </div>\n    <button id="refresh" type="button">Refresh</button>\n  </header>\n  <div id="error" class="err" hidden></div>\n  <section class="totals" id="totals">\n    <div class="label">Portfolio value</div>\n    <div class="value" id="totalValue">—</div>\n    <div class="row3">\n      <div class="stat"><div class="k">Total return</div><div class="v" id="totalReturn">—</div></div>\n      <div class="stat"><div class="k">Return %</div><div class="v" id="totalPct">—</div></div>\n      <div class="stat"><div class="k">Cost basis</div><div class="v" id="totalCost">—</div></div>\n    </div>\n    <div class="meta">\n      <span id="updated">Not updated yet</span>\n      <span id="status"></span>\n    </div>\n  </section>\n  <div class="list" id="list"></div>\n  <p class="hint">Bought Nov 5–6, 2026 · Sorted by % return · Prices via TradingView (GitHub Pages) or Yahoo (Cloudflare Worker)</p>\n</div>\n<script>\n/* ===== Easy-to-edit positions (bought Nov 5–6, 2026) ===== */\nconst POSITIONS = [\n  { ticker: "SNDK", shares: 7,  avgCost: 839.19, totalCost: 5874.36, tv: "NASDAQ:SNDK" },\n  { ticker: "OKTA", shares: 25, avgCost: 169.90, totalCost: 4247.54, tv: "NASDAQ:OKTA" },\n  { ticker: "DELL", shares: 5,  avgCost: 331.44, totalCost: 1657.18, tv: "NYSE:DELL" },\n  { ticker: "MRNA", shares: 6,  avgCost: 242.32, totalCost: 1453.93, tv: "NASDAQ:MRNA" },\n  { ticker: "TWST", shares: 8,  avgCost: 120.59, totalCost: 964.74,  tv: "NASDAQ:TWST" },\n  { ticker: "TER",  shares: 4,  avgCost: 220.77, totalCost: 883.08,  tv: "NASDAQ:TER" },\n  { ticker: "NKE",  shares: 15, avgCost: 38.62,  totalCost: 579.24,  tv: "NYSE:NKE" },\n  { ticker: "TSLA", shares: 5,  avgCost: 383.13, totalCost: 1915.66, tv: "NASDAQ:TSLA" },\n];\n/* ========================================================= */\n\nconst $ = (id) => document.getElementById(id);\nconst money = (n) => n == null || Number.isNaN(n) ? "—" :\n  n.toLocaleString("en-US", { style: "currency", currency: "USD" });\nconst pct = (n) => n == null || Number.isNaN(n) ? "—" :\n  `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;\nconst signedMoney = (n) => n == null || Number.isNaN(n) ? "—" :\n  `${n >= 0 ? "+" : "-"}${money(Math.abs(n))}`;\nconst cls = (n) => n > 0.0005 ? "up" : n < -0.0005 ? "down" : "flat";\n\nfunction etStamp(d = new Date()) {\n  return new Intl.DateTimeFormat("en-US", {\n    timeZone: "America/New_York",\n    weekday: "short", month: "short", day: "numeric",\n    hour: "numeric", minute: "2-digit", second: "2-digit",\n    hour12: true, timeZoneName: "short"\n  }).format(d);\n}\n\nasync function fetchViaWorker() {\n  const r = await fetch("/api/quotes", { cache: "no-store" });\n  if (!r.ok) throw new Error(`Worker quotes HTTP ${r.status}`);\n  const data = await r.json();\n  return data.quotes || data;\n}\n\nasync function fetchViaTradingView() {\n  const body = {\n    symbols: { tickers: POSITIONS.map(p => p.tv), query: { types: [] } },\n    columns: ["close", "change", "change_abs", "description"]\n  };\n  const r = await fetch("https://scanner.tradingview.com/america/scan", {\n    method: "POST",\n    headers: { "Content-Type": "application/json" },\n    body: JSON.stringify(body),\n    cache: "no-store"\n  });\n  if (!r.ok) throw new Error(`TradingView HTTP ${r.status}`);\n  const data = await r.json();\n  const bySym = {};\n  for (const row of (data.data || [])) {\n    const bare = String(row.s || "").split(":").pop();\n    const [close, changePct, changeAbs, description] = row.d;\n    bySym[bare] = {\n      price: close,\n      dayChange: changeAbs,\n      dayChangePct: changePct,\n      name: description || bare\n    };\n  }\n  return bySym;\n}\n\nasync function loadQuotes() {\n  // Prefer same-origin Worker proxy when available; else TradingView (CORS OK for Pages).\n  try {\n    if (location.hostname.endsWith("workers.dev") || location.pathname.includes("api")) {\n      return { quotes: await fetchViaWorker(), source: "Yahoo via Worker" };\n    }\n  } catch (_) {}\n  try {\n    const probe = await fetch("/api/quotes", { cache: "no-store" });\n    if (probe.ok) {\n      const data = await probe.json();\n      return { quotes: data.quotes || data, source: "Yahoo via Worker" };\n    }\n  } catch (_) {}\n  return { quotes: await fetchViaTradingView(), source: "TradingView" };\n}\n\nfunction render(quotes) {\n  const rows = POSITIONS.map(p => {\n    const q = quotes[p.ticker] || {};\n    const price = Number(q.price);\n    const marketValue = price * p.shares;\n    const gain = marketValue - p.totalCost;\n    const gainPct = (gain / p.totalCost) * 100;\n    return {\n      ...p,\n      name: q.name || p.ticker,\n      price,\n      dayChange: Number(q.dayChange),\n      dayChangePct: Number(q.dayChangePct),\n      marketValue,\n      gain,\n      gainPct,\n      ok: Number.isFinite(price)\n    };\n  }).filter(r => r.ok);\n\n  rows.sort((a, b) => b.gainPct - a.gainPct);\n\n  const totalCost = POSITIONS.reduce((s, p) => s + p.totalCost, 0);\n  const totalValue = rows.reduce((s, r) => s + r.marketValue, 0);\n  const totalGain = totalValue - totalCost;\n  const totalGainPct = (totalGain / totalCost) * 100;\n\n  $("totalValue").textContent = money(totalValue);\n  $("totalReturn").textContent = signedMoney(totalGain);\n  $("totalReturn").className = "v " + cls(totalGain);\n  $("totalPct").textContent = pct(totalGainPct);\n  $("totalPct").className = "v " + cls(totalGainPct);\n  $("totalCost").textContent = money(totalCost);\n\n  $("list").innerHTML = rows.map(r => `\n    <article class="card">\n      <div>\n        <div class="ticker">${r.ticker}</div>\n        <div class="name">${r.shares} sh · avg ${money(r.avgCost)}</div>\n      </div>\n      <div>\n        <div class="price">${money(r.price)}</div>\n        <div class="day ${cls(r.dayChange)}">${signedMoney(r.dayChange)} (${pct(r.dayChangePct)})</div>\n      </div>\n      <div style="grid-column:1/-1">\n        <span class="pill ${cls(r.gain)}">${signedMoney(r.gain)} · ${pct(r.gainPct)}</span>\n      </div>\n      <div class="details">\n        <div><div class="k">Market value</div><div class="v">${money(r.marketValue)}</div></div>\n        <div><div class="k">Cost</div><div class="v">${money(r.totalCost)}</div></div>\n        <div><div class="k">Day move</div><div class="v ${cls(r.dayChange)}">${pct(r.dayChangePct)}</div></div>\n      </div>\n    </article>\n  `).join("");\n\n  return { totalValue, totalGain, totalGainPct, totalCost, count: rows.length };\n}\n\nasync function refresh() {\n  const btn = $("refresh");\n  const err = $("error");\n  err.hidden = true;\n  btn.disabled = true;\n  btn.textContent = "Updating…";\n  $("status").textContent = "Fetching live prices…";\n  try {\n    const { quotes, source } = await loadQuotes();\n    const summary = render(quotes);\n    $("updated").textContent = "Updated " + etStamp();\n    $("status").textContent = source + " · " + summary.count + " tickers";\n  } catch (e) {\n    err.hidden = false;\n    err.textContent = "Could not refresh prices: " + (e && e.message ? e.message : e);\n    $("status").textContent = "Refresh failed";\n  } finally {\n    btn.disabled = false;\n    btn.textContent = "Refresh";\n  }\n}\n\n$("refresh").addEventListener("click", refresh);\nrefresh();\n</script>\n</body>\n</html>\n';
