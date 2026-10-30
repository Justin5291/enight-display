const cache = new Map();
let getState = () => ({ settings: {}, markets: [], live: {} });
let onUpdate = () => {};
let onResolved = () => {};
let timer = null;
let pulling = false;
let queued = false;

const TICKER_RE = /^[A-Z0-9][A-Z0-9._-]*-[A-Z0-9._-]+$/;
const MAX_OUTCOMES = 6;
const MAX_CANDLES = 4000;
const CANDLE_MS = 5 * 60 * 1000;
const PALETTE = ["#f0d78c", "#34d399", "#a78bfa", "#fb923c", "#22d3ee", "#f472b6"];
const RANGES = {
  "1H": { period: 1, span: 60 * 60 },
  "1D": { period: 1, span: 24 * 60 * 60 },
  "1W": { period: 60, span: 7 * 24 * 60 * 60 },
  "1M": { period: 60, span: 30 * 24 * 60 * 60 },
  "ALL": { period: 1440, span: 0 }
};

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

export function normalizeRange(range) {
  const key = String(range || "ALL").toUpperCase();
  return RANGES[key] ? key : "ALL";
}

export function rangeSpec(range) {
  const key = normalizeRange(range);
  const spec = RANGES[key];
  return { range: key, period: spec.period, span: spec.span };
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

function defined(value) {
  return value != null && value !== "";
}

function sidePct(side) {
  if (!defined(side)) return null;
  if (typeof side !== "object") return priceToPct(side);
  if (defined(side.close_dollars)) return priceToPct(side.close_dollars);
  if (defined(side.close)) return priceToPct(side.close);
  return null;
}

function readCandleYes(c) {
  const price = c.price && typeof c.price === "object" ? c.price : null;
  if (price && defined(price.close_dollars)) {
    const yes = priceToPct(price.close_dollars);
    if (yes != null) return yes;
  }
  if (price && defined(price.close)) {
    const yes = priceToPct(price.close);
    if (yes != null) return yes;
  }
  if (!price && defined(c.price) && typeof c.price !== "object") {
    const yes = priceToPct(c.price);
    if (yes != null) return yes;
  }
  const bid = sidePct(c.yes_bid);
  const ask = sidePct(c.yes_ask);
  if (bid != null && ask != null) return (bid + ask) / 2;
  if (bid != null) return bid;
  if (ask != null) return ask;
  if (c.yes_price && typeof c.yes_price === "object") {
    if (defined(c.yes_price.close_dollars)) {
      const yes = priceToPct(c.yes_price.close_dollars);
      if (yes != null) return yes;
    }
    if (defined(c.yes_price.close)) {
      const yes = priceToPct(c.yes_price.close);
      if (yes != null) return yes;
    }
  }
  if (defined(c.yes)) return priceToPct(c.yes);
  if (defined(c.close)) return priceToPct(c.close);
  return null;
}

export function candlePoint(c, prevYes) {
  if (!c || typeof c !== "object") return null;
  const rawT = c.end_period_ts != null ? c.end_period_ts : (c.end_ts != null ? c.end_ts : (c.ts != null ? c.ts : c.time));
  const ts = Number(rawT);
  if (!Number.isFinite(ts)) return null;
  let yes = readCandleYes(c);
  if (yes == null && Number.isFinite(prevYes)) yes = prevYes;
  if (yes == null) return null;
  return { t: ts > 1e12 ? ts : ts * 1000, yes: yes };
}

export function candlesToPoints(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  list.sort((a, b) => candleStamp(a) - candleStamp(b));
  const points = [];
  let prev = null;
  for (let i = 0; i < list.length; i++) {
    const pt = candlePoint(list[i], prev);
    if (!pt) continue;
    if (points.length && points[points.length - 1].t === pt.t) points[points.length - 1] = pt;
    else points.push(pt);
    prev = pt.yes;
  }
  return points;
}

function candleStamp(c) {
  if (!c) return 0;
  const t = c.end_period_ts != null ? c.end_period_ts : (c.end_ts != null ? c.end_ts : (c.ts != null ? c.ts : c.time));
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function change24h(points, pct, nowMs) {
  if (pct == null || !Number.isFinite(pct) || !points || !points.length) return null;
  const rows = points.slice().sort((a, b) => a.t - b.t);
  const target = (nowMs || Date.now()) - 24 * 60 * 60 * 1000;
  let baseline = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].t <= target) baseline = rows[i].yes;
    else break;
  }
  // A 1D series starts at the 24h mark, so its first candle lands just after the target.
  if (baseline == null && rows[0].t - target < 2 * 60 * 60 * 1000) baseline = rows[0].yes;
  if (baseline == null || !Number.isFinite(baseline)) return null;
  return pct - baseline;
}

export function outcomeColor(name, index) {
  const party = partyColor(name);
  if (party) return party;
  const i = Math.abs(Number(index) || 0);
  return PALETTE[i % PALETTE.length];
}

function partyColor(name) {
  const n = String(name || "").toLowerCase();
  if (/\bdemocrats?\b/.test(n) || n.indexOf("democratic") >= 0 || /\bdem\b/.test(n)) return "#3b82f6";
  if (/\brepublicans?\b/.test(n) || n.indexOf("republican") >= 0 || /\bgop\b/.test(n)) return "#ef4444";
  return "";
}

function outcomeLabel(market) {
  return String(market.yes_sub_title || market.subtitle || market.title || market.ticker || "YES");
}

function openMs(market) {
  const t = Date.parse(market && market.open_time);
  return Number.isFinite(t) ? t : null;
}

export function buildOutcomes(kind, markets) {
  const rows = [];
  const list = Array.isArray(markets) ? markets : [];
  for (let i = 0; i < list.length; i++) {
    const market = list[i];
    if (!market || !market.ticker) continue;
    rows.push({ market: market, pct: marketYesPct(market) });
  }
  rows.sort((a, b) => {
    if (a.pct == null && b.pct == null) return 0;
    if (a.pct == null) return 1;
    if (b.pct == null) return -1;
    return b.pct - a.pct;
  });
  const limit = kind === "market" ? 1 : MAX_OUTCOMES;
  const top = rows.slice(0, limit);
  const outcomes = [];
  let paletteAt = 0;
  for (let i = 0; i < top.length; i++) {
    const market = top[i].market;
    const name = kind === "market" ? "YES" : outcomeLabel(market);
    const party = partyColor(name);
    let color = party;
    if (!color) {
      color = PALETTE[paletteAt % PALETTE.length];
      paletteAt += 1;
    }
    outcomes.push({
      ticker: market.ticker,
      name: name,
      pct: top[i].pct,
      color: color,
      openTs: openMs(market),
      points: [],
      change: null
    });
  }
  return outcomes;
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
  if (pulling) {
    queued = true;
    return;
  }
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  const s = getState();
  const market = s.markets.find((m) => m.id === s.live.marketId) || s.markets[0];
  if (!market) return;
  const prev = cache.get(market.id) || null;
  if (!s.settings.kalshiProxy) {
    cache.set(market.id, { ...(prev || {}), error: "proxy", updated: prev && prev.updated || 0 });
    onUpdate();
    return;
  }
  pulling = true;
  try {
    const range = normalizeRange(market.range);
    const board = await resolveBoard(s.settings.kalshiProxy, market.ticker, market.kind);
    const reload = needsCandles(prev, board, range);
    let candlesAt = prev && prev.candlesAt || 0;
    if (reload) {
      const ok = await attachCandles(s.settings.kalshiProxy, board, range, prev);
      if (ok) candlesAt = Date.now();
    } else {
      reusePoints(board, prev);
    }
    const quote = {
      kind: board.kind,
      title: board.title,
      subtitle: board.subtitle,
      category: board.category,
      outcomes: board.outcomes,
      pct: board.outcomes[0] ? board.outcomes[0].pct : null,
      points: board.outcomes[0] ? board.outcomes[0].points : [],
      updated: Date.now(),
      candlesAt: candlesAt,
      error: null,
      ticker: board.ticker,
      series: board.series,
      range: range
    };
    cache.set(market.id, quote);
    const changed = {};
    let any = false;
    if (board.kind === "market" && board.ticker && board.ticker !== market.ticker) {
      changed.ticker = board.ticker;
      any = true;
    }
    if (board.series && board.series !== market.series) {
      changed.series = board.series;
      any = true;
    }
    if (board.title && (!market.label || market.label === market.ticker)) {
      changed.label = board.title;
      any = true;
    }
    if (any) onResolved({ id: market.id, ...changed });
    onUpdate();
  } catch (e) {
    const kept = cache.get(market.id) || {};
    cache.set(market.id, {
      ...kept,
      error: e.message || "Kalshi request failed",
      updated: kept.updated || 0
    });
    onUpdate();
  } finally {
    pulling = false;
    if (queued) {
      queued = false;
      refreshSelected();
    }
  }
}

function needsCandles(prev, board, range) {
  if (!prev || prev.range !== range || prev.series !== board.series || prev.ticker !== board.ticker) return true;
  if (!prev.candlesAt || Date.now() - prev.candlesAt > CANDLE_MS) return true;
  const outcomes = board.outcomes || [];
  for (let i = 0; i < outcomes.length; i++) {
    const old = findOutcome(prev.outcomes, outcomes[i].ticker);
    if (!old || !old.points || !old.points.length) return true;
  }
  return false;
}

function reusePoints(board, prev) {
  const outcomes = board.outcomes || [];
  for (let i = 0; i < outcomes.length; i++) {
    const old = findOutcome(prev && prev.outcomes, outcomes[i].ticker);
    outcomes[i].points = old && old.points ? old.points.slice() : [];
    outcomes[i].change = change24h(outcomes[i].points, outcomes[i].pct);
  }
}

async function attachCandles(proxy, board, range, prev) {
  let ok = false;
  await Promise.all(board.outcomes.map(async (outcome) => {
    const old = findOutcome(prev && prev.outcomes, outcome.ticker);
    try {
      outcome.points = await loadCandles(proxy, board.series, outcome.ticker, range, outcome.openTs);
      ok = true;
    } catch (e) {
      outcome.points = old && old.points ? old.points.slice() : [];
    }
    outcome.change = change24h(outcome.points, outcome.pct);
  }));
  return ok;
}

function findOutcome(outcomes, ticker) {
  if (!outcomes) return null;
  for (let i = 0; i < outcomes.length; i++) {
    if (outcomes[i].ticker === ticker) return outcomes[i];
  }
  return null;
}

export async function loadBoard(proxy, input, range) {
  const board = await resolveBoard(proxy, input);
  const key = normalizeRange(range);
  board.range = key;
  await Promise.all(board.outcomes.map(async (outcome) => {
    outcome.points = await loadCandles(proxy, board.series, outcome.ticker, key, outcome.openTs);
    outcome.change = change24h(outcome.points, outcome.pct);
  }));
  return board;
}

export async function resolveBoard(proxy, input, hint) {
  const parsed = typeof input === "string" ? parseKalshiInput(input) : null;
  const ticker = parsed ? parsed.ticker : asTicker(input);
  if (!ticker) throw new Error("Could not read a ticker");
  const resolved = await resolveTarget(proxy, ticker, hint);
  const series = resolved.series || (parsed && parsed.series) || extractSeries(ticker);
  return {
    kind: resolved.kind,
    ticker: resolved.ticker || ticker,
    series: series,
    title: resolved.title || ticker,
    subtitle: resolved.subtitle || "",
    category: resolved.category || "",
    outcomes: buildOutcomes(resolved.kind, resolved.markets)
  };
}

async function resolveTarget(proxy, ticker, hint) {
  let market = null;
  if (hint !== "event") try {
    const data = await kget(proxy, "/trade-api/v2/markets/" + encodeURIComponent(ticker));
    const row = data.market || data;
    if (row && (row.ticker || row.yes_sub_title || row.title)) market = row;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  if (market) {
    let parent = null;
    if (market.event_ticker) {
      try {
        const data = await kget(proxy, "/trade-api/v2/events/" + encodeURIComponent(market.event_ticker));
        parent = data.event || data;
      } catch (e) { parent = null; }
    }
    const series = market.series_ticker || (parent && parent.series_ticker) || extractSeries(market.ticker || ticker);
    return {
      kind: "market",
      ticker: market.ticker || ticker,
      series: series,
      title: market.title || market.yes_sub_title || ticker,
      subtitle: (parent && parent.sub_title) || "",
      category: (parent && parent.category) || market.category || "",
      markets: [market]
    };
  }
  const data = await kget(proxy, "/trade-api/v2/events/" + encodeURIComponent(ticker) + "?with_nested_markets=true");
  const packed = marketsFromPayload(data);
  if (!packed.markets.length) throw new Error("No market on that event");
  const event = packed.event;
  const first = packed.markets[0];
  const series = (event && event.series_ticker) || (first && first.series_ticker) || extractSeries((first && first.ticker) || ticker);
  return {
    kind: "event",
    ticker: (event && event.event_ticker) || ticker,
    series: series,
    title: (event && event.title) || ticker,
    subtitle: (event && event.sub_title) || "",
    category: (event && event.category) || "",
    markets: packed.markets
  };
}

// Event responses include a top-level markets array that is often empty.
// The contracts live on event.markets.
function marketsFromPayload(data) {
  const event = data && data.event && typeof data.event === "object" ? data.event : {};
  const nested = Array.isArray(event.markets) ? event.markets : [];
  if (nested.length) return { event: event, markets: nested };
  const top = data && Array.isArray(data.markets) ? data.markets : [];
  return { event: event, markets: top };
}

export async function loadCandles(proxy, series, ticker, range, openTs) {
  const spec = RANGES[normalizeRange(range)];
  const end = Math.floor(Date.now() / 1000);
  let start;
  if (spec.span) start = end - spec.span;
  else if (Number.isFinite(openTs)) start = Math.floor(Number(openTs) / 1000) - 3600;
  else start = end - 4 * 365 * 24 * 60 * 60;
  const earliest = end - 8 * 365 * 24 * 60 * 60;
  if (start < earliest) start = earliest;
  if (start >= end) start = end - spec.period * 60 * 2;
  const width = spec.period * 60;
  const maxSpan = MAX_CANDLES * width;
  const rows = [];
  let cursor = start;
  while (cursor < end) {
    const chunkEnd = Math.min(end, cursor + maxSpan);
    const path = "/trade-api/v2/series/" + encodeURIComponent(series) + "/markets/" + encodeURIComponent(ticker) +
      "/candlesticks?start_ts=" + Math.floor(cursor) + "&end_ts=" + Math.floor(chunkEnd) + "&period_interval=" + spec.period;
    const data = await kget(proxy, path);
    const part = data.candlesticks || data.candles || [];
    for (let i = 0; i < part.length; i++) rows.push(part[i]);
    if (chunkEnd >= end) break;
    cursor = chunkEnd;
  }
  return candlesToPoints(rows);
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
