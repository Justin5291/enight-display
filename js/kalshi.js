const cache = new Map();
let getState = () => ({ settings: {}, markets: [], live: {} });
let onUpdate = () => {};
let onResolved = () => {};
let timer = null;
let pulling = false;

const TICKER_RE = /^[A-Z0-9][A-Z0-9._-]*-[A-Z0-9._-]+$/;

function asTicker(value) {
  const ticker = safeUpper(String(value || "").trim());
  if (!ticker || ticker.length > 120 || !TICKER_RE.test(ticker)) return null;
  return ticker;
}

export function parseKalshiInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) {
    let url;
    try { url = new URL(text); } catch (e) { return null; }
    const host = url.hostname.toLowerCase();
    if (host !== "kalshi.com" && !host.endsWith(".kalshi.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase() === "markets");
    let series = idx >= 0 ? safeUpper(parts[idx + 1] || "") : "";
    let ticker = parts.length ? parts[parts.length - 1] : "";
    const q = url.searchParams.get("ticker") || url.searchParams.get("market");
    if (q) ticker = q;
    ticker = asTicker(ticker);
    if (!ticker) return null;
    if (!series || series === ticker || !/^[A-Z0-9][A-Z0-9._-]{0,80}$/.test(series)) series = extractSeries(ticker);
    return { ticker: ticker, series: series, sourceUrl: text };
  }
  if (/\s/.test(text)) return null;
  const ticker = asTicker(text);
  if (!ticker) return null;
  return { ticker: ticker, series: extractSeries(ticker), sourceUrl: "" };
}

export function extractSeries(ticker) {
  const t = String(ticker || "").toUpperCase();
  const i = t.indexOf("-");
  return i > 0 ? t.slice(0, i) : t;
}

export function priceToPct(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  const fractional = /[.]|[eE]/.test(raw);
  if (fractional) {
    if (n <= 1) return n * 100;
    if (n <= 100) return n;
    return null;
  }
  if (n <= 100) return n;
  return null;
}

export function marketYesPct(market) {
  if (!market || typeof market !== "object") return null;
  const last = priceToPct(market.last_price_dollars != null ? market.last_price_dollars : market.last_price);
  if (last != null) return last;
  const bid = priceToPct(market.yes_bid_dollars != null ? market.yes_bid_dollars : market.yes_bid);
  const ask = priceToPct(market.yes_ask_dollars != null ? market.yes_ask_dollars : market.yes_ask);
  if (bid != null && ask != null) return (bid + ask) / 2;
  return bid != null ? bid : ask;
}

export function candlePoint(c) {
  if (!c || typeof c !== "object") return null;
  const t = c.end_period_ts != null ? c.end_period_ts : (c.end_ts != null ? c.end_ts : (c.ts != null ? c.ts : c.time));
  let raw = null;
  if (c.price && typeof c.price === "object") raw = c.price.close != null ? c.price.close : (c.price.mean != null ? c.price.mean : c.price.open);
  else if (c.price != null) raw = c.price;
  else if (c.yes_price && typeof c.yes_price === "object") raw = c.yes_price.close;
  else if (c.yes_bid && typeof c.yes_bid === "object") raw = c.yes_bid.close;
  else raw = c.yes != null ? c.yes : c.close;
  const yes = priceToPct(raw);
  const ts = Number(t);
  if (!Number.isFinite(ts) || yes == null) return null;
  return { t: ts > 1e12 ? ts : ts * 1000, yes: yes };
}

export function getQuote(id) {
  return cache.get(id) || null;
}

export function startKalshi(getStateFn, onUpdateFn, onResolvedFn) {
  getState = getStateFn;
  onUpdate = onUpdateFn || (() => {});
  onResolved = onResolvedFn || (() => {});
  schedule();
  refreshSelected();
}

export function pokeKalshi() {
  refreshSelected();
}

function schedule() {
  clearTimeout(timer);
  const sec = Number(getState().settings.kalshiRefreshSec) || 20;
  timer = setTimeout(async () => {
    await refreshSelected();
    schedule();
  }, Math.max(5, sec) * 1000);
}

async function refreshSelected() {
  if (pulling) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  const s = getState();
  const market = s.markets.find((m) => m.id === s.live.marketId) || s.markets[0];
  if (!market) return;
  if (!s.settings.kalshiProxy) {
    const prev = cache.get(market.id) || {};
    cache.set(market.id, { ...prev, error: "proxy", updated: prev.updated || 0 });
    onUpdate();
    return;
  }
  pulling = true;
  try {
    const loaded = await loadMarket(s.settings.kalshiProxy, market.ticker);
    let points = [];
    try {
      points = await loadCandles(s.settings.kalshiProxy, loaded.series, loaded.ticker);
    } catch (e) {
      points = (cache.get(market.id) && cache.get(market.id).points) || [];
    }
    const title = loaded.market.title || loaded.market.yes_sub_title || market.label || loaded.ticker;
    cache.set(market.id, {
      pct: marketYesPct(loaded.market),
      title: title,
      subtitle: loaded.market.subtitle || loaded.market.yes_sub_title || "",
      points: points,
      updated: Date.now(),
      error: null,
      ticker: loaded.ticker,
      series: loaded.series
    });
    const changed = {};
    let any = false;
    if (loaded.ticker && loaded.ticker !== market.ticker) { changed.ticker = loaded.ticker; any = true; }
    if (loaded.series && loaded.series !== market.series) { changed.series = loaded.series; any = true; }
    if (title && (!market.label || market.label === market.ticker)) { changed.label = title; any = true; }
    if (any) onResolved({ id: market.id, ...changed });
    onUpdate();
  } catch (e) {
    const prev = cache.get(market.id) || {};
    cache.set(market.id, { ...prev, error: e.message || "Kalshi request failed", updated: prev.updated || Date.now() });
    onUpdate();
  } finally {
    pulling = false;
  }
}

export async function loadMarket(proxy, ticker) {
  try {
    const data = await kget(proxy, "/trade-api/v2/markets/" + encodeURIComponent(ticker));
    const market = data.market || data;
    const series = market.series_ticker || extractSeries(market.ticker || ticker);
    return { market: market, ticker: market.ticker || ticker, series: series };
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const data = await kget(proxy, "/trade-api/v2/events/" + encodeURIComponent(ticker) + "?with_nested_markets=true");
  const markets = data.markets || (data.event && data.event.markets) || [];
  if (!markets.length) throw new Error("No market on that event");
  const market = markets[0];
  const series = market.series_ticker || (data.event && data.event.series_ticker) || extractSeries(market.ticker || ticker);
  return { market: market, ticker: market.ticker || ticker, series: series };
}

export async function loadCandles(proxy, series, ticker) {
  const end = Math.floor(Date.now() / 1000);
  const once = async (start, period) => {
    const path = "/trade-api/v2/series/" + encodeURIComponent(series) + "/markets/" + encodeURIComponent(ticker) +
      "/candlesticks?start_ts=" + start + "&end_ts=" + end + "&period_interval=" + period;
    const data = await kget(proxy, path);
    const rows = data.candlesticks || data.candles || [];
    return rows.map(candlePoint).filter(Boolean);
  };
  try {
    const minutes = await once(end - 12 * 60 * 60, 1);
    if (minutes.length >= 2) return minutes;
  } catch (e) { /* hourly fallback */ }
  return once(end - 2 * 24 * 60 * 60, 60);
}

async function kget(proxy, path) {
  const base = String(proxy || "").replace(/\/$/, "");
  const res = await fetch(base + path, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const err = new Error("HTTP " + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function safeUpper(value) {
  try { return decodeURIComponent(value).toUpperCase(); }
  catch (e) { return String(value).toUpperCase(); }
}
