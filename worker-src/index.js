/**
 * stock-tracker Cloudflare Worker
 * Serves UI from ASSETS and proxies live quotes at /api/quotes.
 * Edit POSITIONS in public/index.html (UI) and here (API cost basis unused; quotes only).
 */

const TICKERS = ["SNDK", "OKTA", "DELL", "MRNA", "TWST", "TER", "NKE", "TSLA"];

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
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; stock-tracker/1.0)",
      Accept: "application/json",
    },
  });
  if (!r.ok) throw new Error(`CNBC ${ticker} ${r.status}`);
  const d = await r.json();
  const q = d?.FormattedQuoteResult?.FormattedQuote?.[0];
  if (!q?.last) throw new Error(`CNBC ${ticker} empty`);
  const price = Number(String(q.last).replace(/,/g, ""));
  const dayChange = Number(String(q.change || "0").replace(/,/g, ""));
  let dayChangePct = Number(String(q.change_pct || q.pctchg || "0").replace(/[%+,]/g, ""));
  if (!Number.isFinite(dayChangePct) && price) {
    const prev = price - dayChange;
    dayChangePct = prev ? (dayChange / prev) * 100 : 0;
  }
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/quotes") {
      try {
        const entries = await Promise.all(
          TICKERS.map(async (t) => [t, await quoteOne(t)])
        );
        const quotes = Object.fromEntries(entries);
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
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
          },
        });
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Missing ASSETS binding", { status: 500 });
  },
};
