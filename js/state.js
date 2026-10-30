import { SCREENS, freshState, DEFAULT_KALSHI_PROXY, defaultCategories, DEFAULTS_VERSION, defaultKalshiMarket, isUneditedShippedSite } from "./data.js";
import { normalizeRange } from "./kalshi.js";
import { RACE_MARKETS } from "./kalshi-races.js";

const KEY = "enight-display-v1";

let state = freshState();
const listeners = new Set();
let saveTimer = null;

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const before = readDefaultsVersion(saved);
      state = hydrate(saved);
      if (before < DEFAULTS_VERSION) flushSave();
    } else state = normalize(freshState());
  } catch (e) {
    state = normalize(freshState());
    window.__enightLastError = "Saved show data could not be read. Started from the preset.";
  }
  return state;
}

/* Merge a saved show onto the preset, then run the one-time defaults migration.
   The preset's defaultsVersion must not hide a save that never stored one. */
export function hydrate(saved) {
  const source = saved && typeof saved === "object" ? saved : {};
  const merged = merge(freshState(), source);
  merged.settings = merged.settings || {};
  merged.settings.defaultsVersion = readDefaultsVersion(source);
  return normalize(merged);
}

function readDefaultsVersion(saved) {
  const settings = saved && saved.settings;
  if (!settings || typeof settings !== "object" || !Object.prototype.hasOwnProperty.call(settings, "defaultsVersion")) return 0;
  const n = Number(settings.defaultsVersion);
  return Number.isFinite(n) ? n : 0;
}

export function update(fn) {
  fn(state);
  state = normalize(state);
  emit();
  scheduleSave();
  return state;
}

export function replaceState(next) {
  state = normalize(next);
  emit();
  flushSave();
  return state;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 40);
}

export function flushSave() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    window.__enightLastError = "Could not save on this iPad (" + e.message + ")";
  }
}

export function exportPayload() {
  return {
    ...JSON.parse(JSON.stringify(state)),
    exportedAt: new Date().toISOString(),
    note: "File media (photos, video, PDFs) stay in this iPad's IndexedDB and are not inside this JSON. URL media entries are included."
  };
}

export function importPayload(obj) {
  if (!obj || typeof obj !== "object" || obj.version !== 1) {
    throw new Error("This file is not an Election Night backup.");
  }
  const copy = { ...obj };
  delete copy.exportedAt;
  delete copy.note;
  replaceState(hydrate(copy));
}

export function resetShow() {
  const media = state.media;
  state = freshState();
  state.media = Array.isArray(media) ? media : [];
  normalize(state);
  emit();
  flushSave();
}

export function setCall(raceId, candidateId, opts) {
  update((s) => {
    const race = s.races.find((r) => r.id === raceId);
    if (!race) return;
    const prev = race.controlApplied;
    if (candidateId == null) {
      race.calledId = null;
      if (prev) bump(s, race.control, prev, -1);
      race.controlApplied = null;
      return;
    }
    const cand = (race.candidates || []).find((c) => c.id === candidateId);
    if (!cand) return;
    race.calledId = cand.id;
    s.live.raceId = race.id;
    if (!opts || !opts.keepScreen) s.screen = "call";
    if (prev) bump(s, race.control, prev, -1);
    const applicable = cand.party === "R" || cand.party === "D" || cand.party === "I";
    if (s.settings.applyCallsToControl && race.control && applicable) {
      bump(s, race.control, cand.party, 1);
      race.controlApplied = cand.party;
    } else {
      race.controlApplied = null;
    }
  });
}

function bump(s, chamber, party, delta) {
  if (chamber !== "senate" && chamber !== "house") return;
  const key = party === "R" ? "r" : party === "D" ? "d" : party === "I" ? "i" : null;
  if (!key) return;
  s[chamber][key] = Math.max(0, (Number(s[chamber][key]) || 0) + delta);
}

export function visualKey(s) {
  switch (s.screen) {
    case "call":
    case "tally":
      return s.screen + ":" + s.live.raceId;
    case "segment":
      return s.screen + ":" + s.live.segmentId;
    case "kalshi":
      return s.screen + ":" + s.live.marketId;
    case "site":
      return s.screen + ":" + s.live.siteId;
    case "mediashow":
      return s.screen + ":" + s.live.mediaId;
    default:
      return s.screen;
  }
}

function merge(base, saved) {
  if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
  if (base && typeof base === "object") {
    const out = {};
    const src = saved && typeof saved === "object" ? saved : {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], src[k]);
    for (const k of Object.keys(src)) if (!(k in out)) out[k] = src[k];
    return out;
  }
  return saved === undefined ? base : saved;
}

function normalize(s) {
  s.version = 1;
  if (s.screen === "sites" || s.screen === "media") s.screen = "home";
  if (!SCREENS.includes(s.screen)) s.screen = "home";
  s.live = s.live || {};
  s.settings = s.settings || {};
  s.settings.markup = s.settings.markup || {};
  s.settings.hideMs = clampNum(s.settings.hideMs, 3000, 60000, 8000);
  s.settings.kalshiRefreshSec = clampNum(s.settings.kalshiRefreshSec, 5, 120, 20);
  s.settings.electionDate = /^\d{4}-\d{2}-\d{2}$/.test(s.settings.electionDate) ? s.settings.electionDate : "2026-11-03";
  s.settings.feedDate = /^\d{4}-\d{2}-\d{2}$/.test(s.settings.feedDate) ? s.settings.feedDate : "2026-11-03";
  s.settings.timezone = s.settings.timezone || "America/New_York";
  s.settings.autoClosePolls = s.settings.autoClosePolls !== false;
  s.settings.applyCallsToControl = !!s.settings.applyCallsToControl;
  s.settings.kalshiProxy = String(s.settings.kalshiProxy || "").trim() || DEFAULT_KALSHI_PROXY;
  const cats = defaultCategories();
  const savedCats = s.settings.categories && typeof s.settings.categories === "object" ? s.settings.categories : {};
  for (const key of Object.keys(cats)) {
    if (typeof savedCats[key] === "boolean") cats[key] = savedCats[key];
  }
  s.settings.categories = cats;
  const mk = s.settings.markup;
  mk.color = /^#[0-9a-fA-F]{6}$/.test(mk.color) ? mk.color : "#ffe14a";
  mk.size = clampNum(mk.size, 4, 48, 18);
  if (!["pen", "highlighter", "line", "arrow", "rect", "ellipse"].includes(mk.tool)) mk.tool = "pen";
  mk.autoClear = mk.autoClear !== false;
  s.brand = s.brand || {};
  s.brand.title = s.brand.title || "ELECTION NIGHT";
  s.brand.show = s.brand.show || "THE DAN BONGINO SHOW";
  s.brand.logo = s.brand.logo == null ? "LOGO" : String(s.brand.logo);
  for (const key of ["senate", "house"]) {
    const b = s[key] || {};
    b.r = num(b.r);
    b.d = num(b.d);
    b.i = num(b.i);
    b.vacant = num(b.vacant);
    b.total = num(b.total) || (key === "senate" ? 100 : 435);
    b.majority = num(b.majority) || (key === "senate" ? 51 : 218);
    b.subtitle = b.subtitle || "CURRENT";
    s[key] = b;
  }
  if (!Array.isArray(s.races)) s.races = [];
  for (const race of s.races) {
    race.candidates = Array.isArray(race.candidates) ? race.candidates : [];
    race.reporting = clampNum(race.reporting, 0, 100, 0);
    race.calledId = race.calledId || null;
    race.controlApplied = race.controlApplied || null;
    if (race.control !== "senate" && race.control !== "house") race.control = null;
    for (const c of race.candidates) {
      c.votes = num(c.votes);
      c.name = c.name || "Candidate";
      if (!["R", "D", "I", "O"].includes(c.party)) c.party = "O";
      if (!c.id) c.id = "c-" + Math.random().toString(36).slice(2, 8);
    }
  }
  if (!Array.isArray(s.states)) s.states = [];
  for (const st of s.states) {
    st.closeMin = num(st.closeMin);
    st.featured = !!st.featured;
    st.verified = !!st.verified;
    st.note = st.note || "";
    if (!["auto", "open", "closed", "early", "R", "D"].includes(st.status)) st.status = "auto";
  }
  if (!Array.isArray(s.segments)) s.segments = [];
  for (const seg of s.segments) {
    seg.guests = Array.isArray(seg.guests) ? seg.guests : [];
    seg.sponsor = !!seg.sponsor;
  }
  if (!Array.isArray(s.markets)) s.markets = [];
  if (!Array.isArray(s.sites)) s.sites = [];
  for (const site of s.sites) {
    site.scale = clampNum(site.scale, 0.4, 4, 1);
    site.x = num(site.x);
    site.y = num(site.y);
    site.mode = site.mode === "embed" ? "embed" : "safari";
    site.group = site.group || "Other";
    if (!site.id) site.id = "site-" + Math.random().toString(36).slice(2, 8);
  }
  migrateDefaults(s);
  seedMarkets(s);
  for (const market of s.markets) {
    market.range = normalizeRange(market.range);
    if (!market.id) market.id = "kx-" + Math.random().toString(36).slice(2, 8);
  }
  if (!Array.isArray(s.media)) s.media = [];
  if (!s.races.some((r) => r.id === s.live.raceId)) s.live.raceId = s.races[0] ? s.races[0].id : null;
  if (!s.segments.some((g) => g.id === s.live.segmentId)) s.live.segmentId = s.segments[0] ? s.segments[0].id : null;
  if (s.live.marketId && !s.markets.some((m) => m.id === s.live.marketId)) s.live.marketId = s.markets[0] ? s.markets[0].id : null;
  if (s.live.siteId && !s.sites.some((site) => site.id === s.live.siteId)) s.live.siteId = null;
  if (s.live.mediaId && !s.media.some((m) => m.id === s.live.mediaId)) s.live.mediaId = null;
  if (!s.states.some((st) => st.abbr === s.live.mapState)) s.live.mapState = s.states[0] ? s.states[0].abbr : "OH";
  return s;
}

/* Merge curated race markets into any saved setup. A default the user deleted
   is remembered in settings.seededMarkets and not brought back. User-added
   markets are never touched. */
function seedMarkets(s) {
  const seeded = new Set(Array.isArray(s.settings.seededMarkets) ? s.settings.seededMarkets : []);
  for (const def of RACE_MARKETS) {
    const hit = s.markets.find((m) => m.id === def.id || String(m.ticker || "").toUpperCase() === def.ticker);
    if (hit) {
      if (!hit.category) hit.category = def.category;
      if (!hit.kind && hit.ticker === def.ticker) hit.kind = def.kind;
      if (hit.id === def.id && (!hit.label || hit.label === hit.ticker || hit.label === "Senate control")) hit.label = def.label;
      seeded.add(def.id);
      continue;
    }
    if (seeded.has(def.id)) continue;
    s.markets.push(JSON.parse(JSON.stringify(def)));
    seeded.add(def.id);
  }
  s.settings.seededMarkets = [...seeded];
}

function migrateDefaults(s) {
  const seen = Number(s.settings && s.settings.defaultsVersion) || 0;
  if (seen >= DEFAULTS_VERSION) return;
  /* v4: every auto-populated section is switched on once; the toggles still work after that. */
  if (seen < 4) {
    const cats = s.settings.categories || (s.settings.categories = {});
    for (const key of Object.keys(defaultCategories())) cats[key] = true;
  }
  if (Array.isArray(s.sites)) s.sites = s.sites.filter((site) => !isUneditedShippedSite(site));
  if (!Array.isArray(s.markets) || !s.markets.length) {
    const market = defaultKalshiMarket();
    s.markets = [market];
    s.live = s.live || {};
    s.live.marketId = market.id;
  }
  s.settings.defaultsVersion = DEFAULTS_VERSION;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampNum(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSave);
}
