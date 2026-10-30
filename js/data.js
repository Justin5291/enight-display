import { RACE_MARKETS } from "./kalshi-races.js";
/* Seed data for Election Night 2026. Poll times other than the ones named
   in the spec are best-knowledge and flagged verified:false. */

const STAR = "M12 2l2.9 6.6L22 9.2l-5 4.4 1.5 6.9L12 17.3 5.5 20.5 7 13.6 2 9.2l7.1-.6L12 2z";

function close(hh, mm, extraDays) {
  return (extraDays || 0) * 1440 + hh * 60 + mm;
}

function state(abbr, name, hh, mm, extra) {
  extra = extra || {};
  return {
    abbr: abbr,
    name: name,
    closeMin: close(hh, mm, extra.day || 0),
    verified: !!extra.verified,
    featured: !!extra.featured,
    note: extra.note || "",
    status: "auto"
  };
}

export const STAR_PATH = STAR;

export const SHOW_NOTES = "AK ranked-choice tabulated Nov 18  ·  ME possible ranked-choice  ·  GA runoff if under 50%  ·  CA mail ballots through Nov 10  ·  FL panhandle closes 8:00 PM ET (rest of Florida 7:00)";

/* Tile columns / rows for a 11×8 cartogram. Gap between MI and NY is intentional. */
export const TILES = {
  AK: [0, 0], ME: [10, 0],
  WI: [6, 1], VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], MI: [6, 2], NY: [8, 2], MA: [9, 2], RI: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [8, 7]
};

export const STATES = [
  state("AL", "Alabama", 20, 0),
  state("AK", "Alaska", 0, 0, { day: 1, featured: true, note: "Ranked-choice tabulation Nov 18. Close time not confirmed in the spec." }),
  state("AZ", "Arizona", 21, 0),
  state("AR", "Arkansas", 20, 30),
  state("CA", "California", 23, 0, { note: "Mail ballots accepted through Nov 10." }),
  state("CO", "Colorado", 21, 0),
  state("CT", "Connecticut", 20, 0),
  state("DE", "Delaware", 20, 0),
  state("DC", "District of Columbia", 20, 0),
  state("FL", "Florida", 19, 0, { verified: true, featured: true, note: "Most of the state 7:00 PM ET. Panhandle 8:00 PM ET." }),
  state("GA", "Georgia", 19, 0, { note: "Runoff if no candidate reaches 50%." }),
  state("HI", "Hawaii", 23, 0),
  state("ID", "Idaho", 23, 0),
  state("IL", "Illinois", 20, 0),
  state("IN", "Indiana", 18, 0),
  state("IA", "Iowa", 22, 0, { featured: true }),
  state("KS", "Kansas", 20, 0, { verified: true, featured: true }),
  state("KY", "Kentucky", 18, 0),
  state("LA", "Louisiana", 21, 0),
  state("ME", "Maine", 20, 0, { verified: true, featured: true, note: "Possible ranked-choice tabulation." }),
  state("MD", "Maryland", 20, 0),
  state("MA", "Massachusetts", 20, 0),
  state("MI", "Michigan", 20, 0, { verified: true, featured: true }),
  state("MN", "Minnesota", 21, 0),
  state("MS", "Mississippi", 20, 0),
  state("MO", "Missouri", 20, 0),
  state("MT", "Montana", 22, 0),
  state("NE", "Nebraska", 21, 0),
  state("NV", "Nevada", 22, 0),
  state("NH", "New Hampshire", 20, 0),
  state("NJ", "New Jersey", 20, 0),
  state("NM", "New Mexico", 21, 0),
  state("NY", "New York", 21, 0),
  state("NC", "North Carolina", 19, 30, { verified: true, featured: true }),
  state("ND", "North Dakota", 21, 0),
  state("OH", "Ohio", 19, 30, { verified: true, featured: true }),
  state("OK", "Oklahoma", 20, 0),
  state("OR", "Oregon", 23, 0),
  state("PA", "Pennsylvania", 20, 0),
  state("RI", "Rhode Island", 20, 0),
  state("SC", "South Carolina", 19, 0),
  state("SD", "South Dakota", 21, 0),
  state("TN", "Tennessee", 20, 0),
  state("TX", "Texas", 20, 0, { verified: true, featured: true }),
  state("UT", "Utah", 22, 0),
  state("VT", "Vermont", 19, 0),
  state("VA", "Virginia", 19, 0),
  state("WA", "Washington", 23, 0),
  state("WV", "West Virginia", 19, 30),
  state("WI", "Wisconsin", 21, 0),
  state("WY", "Wyoming", 21, 0)
];

function cand(id, name, party) {
  return { id: id, name: name, party: party, votes: 0 };
}

function race(id, title, short, st, control, a, b) {
  return {
    id: id,
    title: title,
    short: short,
    state: st,
    control: control,
    reporting: 0,
    calledId: null,
    controlApplied: null,
    candidates: [cand(id + "-a", a[0], a[1]), cand(id + "-b", b[0], b[1])]
  };
}

export const RACES = [
  race("fl-gov", "Florida Governor", "FL GOV", "FL", null, ["Donalds", "R"], ["Jolly", "D"]),
  race("fl-sen", "Florida Senate", "FL SEN", "FL", "senate", ["Moody", "R"], ["Nixon", "D"]),
  race("fl-21", "Florida 21", "FL-21", "FL", "house", ["Mast", "R"], ["Democrat", "D"]),
  race("fl-14", "Florida 14", "FL-14", "FL", "house", ["Republican", "R"], ["Democrat", "D"]),
  race("fl-22", "Florida 22", "FL-22", "FL", "house", ["Republican", "R"], ["Democrat", "D"]),
  race("oh-sen", "Ohio Senate", "OH", "OH", "senate", ["Republican", "R"], ["Democrat", "D"]),
  race("me-sen", "Maine Senate", "ME", "ME", "senate", ["Republican", "R"], ["Democrat", "D"]),
  race("mi-sen", "Michigan Senate", "MI", "MI", "senate", ["Republican", "R"], ["Democrat", "D"]),
  race("tx-sen", "Texas Senate", "TX", "TX", "senate", ["Republican", "R"], ["Democrat", "D"]),
  race("ks-sen", "Kansas Senate", "KS", "KS", "senate", ["Republican", "R"], ["Democrat", "D"]),
  race("ia-sen", "Iowa Senate", "IA", "IA", "senate", ["Republican", "R"], ["Democrat", "D"]),
  race("ak-sen", "Alaska Senate", "AK", "AK", "senate", ["Republican", "R"], ["Democrat", "D"])
];

export const SEGMENTS = [
  { id: "standby", time: "7:50 PM ET", code: "STANDBY", title: "Standby", guests: [], detail: "Live at 8:00 PM ET", sponsor: false, sponsorName: "", sponsorLine: "" },
  { id: "open", time: "8:00 PM ET", code: "OPEN", title: "Election Night", guests: ["Dan Bongino", "Vince Coglianese", "Hayley Caronia", "Shawn Farash"], detail: "", sponsor: false, sponsorName: "", sponsorLine: "" },
  { id: "a", time: "8:15 PM ET", code: "A", title: "Rep. Brian Mast", guests: ["Rep. Brian Mast"], detail: "FL-21", sponsor: false, sponsorName: "", sponsorLine: "" },
  { id: "b", time: "8:30 PM ET", code: "B", title: "Seth Keshel", guests: ["Seth Keshel"], detail: "on Zoom", sponsor: false, sponsorName: "", sponsorLine: "" },
  { id: "c", time: "8:45 PM ET", code: "C", title: "Catalina Lauf", guests: ["Catalina Lauf"], detail: "", sponsor: false, sponsorName: "", sponsorLine: "" },
  { id: "d", time: "9:00 PM ET", code: "D", title: "Brenden Dilley & Michael Beatty", guests: ["Brenden Dilley", "Michael Beatty"], detail: "", sponsor: false, sponsorName: "", sponsorLine: "" },
  { id: "e", time: "9:15 PM ET", code: "E", title: "Vince Anchors", guests: ["Vince Coglianese", "Catalina Lauf", "Jim Verdi"], detail: "", sponsor: false, sponsorName: "", sponsorLine: "" },
  { id: "f", time: "9:30 PM ET", code: "F", title: "All Four Hosts", guests: ["Dan Bongino", "Vince Coglianese", "Hayley Caronia", "Shawn Farash", "Steven Crowder"], detail: "Crossover", sponsor: false, sponsorName: "", sponsorLine: "" },
  { id: "close", time: "9:45 PM ET", code: "CLOSE", title: "Close", guests: ["Myles"], detail: "", sponsor: true, sponsorName: "BrickHouse Nutrition", sponsorLine: "with Myles" },
  { id: "off", time: "10:00 PM ET", code: "OFF AIR", title: "Off Air", guests: [], detail: "", sponsor: false, sponsorName: "", sponsorLine: "" }
];

/* Previously shipped website presets. embed: yes = known to allow iframes,
   no = blocked, unknown = not confirmed. Fresh installs no longer seed these.
   Migration removes a saved copy only when it still matches this snapshot. */
export const SHIPPED_SITES = [
  { id: "ddhq", name: "Decision Desk HQ", url: "https://decisiondeskhq.com/", mode: "embed", group: "Results", embed: "yes", scale: 1, x: 0, y: 0 },
  { id: "fox", name: "Fox News Elections", url: "https://www.foxnews.com/elections", mode: "embed", group: "Networks", embed: "yes", scale: 1, x: 0, y: 0 },
  { id: "fl", name: "Florida Results", url: "https://results.elections.myflorida.com/", mode: "embed", group: "Florida", embed: "yes", scale: 1, x: 0, y: 0 },
  { id: "yt", name: "YouTube embed", url: "https://www.youtube.com/embed/VIDEO_ID", mode: "embed", group: "Video", embed: "yes", scale: 1, x: 0, y: 0 },
  { id: "ap", name: "AP News", url: "https://apnews.com/", mode: "safari", group: "Results", embed: "no", scale: 1, x: 0, y: 0 },
  { id: "nyt", name: "New York Times", url: "https://www.nytimes.com/", mode: "safari", group: "Results", embed: "no", scale: 1, x: 0, y: 0 },
  { id: "politico", name: "Politico", url: "https://www.politico.com/", mode: "safari", group: "Results", embed: "no", scale: 1, x: 0, y: 0 },
  { id: "270", name: "270toWin", url: "https://www.270towin.com/", mode: "safari", group: "Results", embed: "no", scale: 1, x: 0, y: 0 },
  { id: "rcp", name: "RealClearPolling", url: "https://www.realclearpolling.com/", mode: "safari", group: "Results", embed: "unknown", scale: 1, x: 0, y: 0 },
  { id: "cnn", name: "CNN", url: "https://www.cnn.com/election", mode: "safari", group: "Networks", embed: "no", scale: 1, x: 0, y: 0 },
  { id: "x", name: "X", url: "https://x.com/", mode: "safari", group: "Video", embed: "no", scale: 1, x: 0, y: 0 },
  { id: "poly", name: "Polymarket", url: "https://polymarket.com/", mode: "safari", group: "Markets", embed: "no", scale: 1, x: 0, y: 0 },
  { id: "kalshi", name: "Kalshi", url: "https://kalshi.com/", mode: "safari", group: "Markets", embed: "unknown", scale: 1, x: 0, y: 0 }
];

export function isUneditedShippedSite(site) {
  if (!site || !site.id) return false;
  const shipped = SHIPPED_SITES.find((row) => row.id === site.id);
  if (!shipped) return false;
  const mode = site.mode === "embed" ? "embed" : "safari";
  return site.name === shipped.name
    && site.url === shipped.url
    && mode === shipped.mode
    && (site.group || "Other") === shipped.group
    && (site.embed || "unknown") === shipped.embed
    && Number(site.scale) === Number(shipped.scale)
    && Number(site.x) === Number(shipped.x)
    && Number(site.y) === Number(shipped.y);
}

export const DEFAULT_KALSHI_PROXY = "https://enight-kalshi-proxy.justin-0ab.workers.dev";

/* Bump when shipped defaults change. Missing or lower versions migrate once. */
export const DEFAULTS_VERSION = 4;

export const DEFAULT_KALSHI_MARKET = {
  id: "kx-senate-control",
  ticker: "CONTROLS-2026",
  series: "CONTROLS",
  label: "Senate control",
  sourceUrl: "https://kalshi.com/markets/controls/senate-winner/controls-2026",
  range: "ALL"
};

export function defaultKalshiMarket() {
  return clone(DEFAULT_KALSHI_MARKET);
}

/* Senate control first, then every curated race, in list order. */
export function defaultMarkets() {
  return RACE_MARKETS.map((row) => clone(row));
}

/* Dashboard sections. `on` is the default. Manual data screens start off. */
export const CATEGORIES = [
  { id: "seats", label: "Seat trackers", on: true },
  { id: "show", label: "Show", on: true },
  { id: "kalshi", label: "Kalshi markets", on: true },
  { id: "sites", label: "Websites", on: true },
  { id: "media", label: "Media / Graphics", on: true },
  { id: "maps", label: "Results maps (Senate, Governor, House)", on: true },
  { id: "countdown", label: "Poll closes (countdown from the poll-closing schedule)", on: true }
];

export function defaultCategories() {
  const out = {};
  for (const cat of CATEGORIES) out[cat.id] = cat.on;
  return out;
}

export const SCREENS = ["home", "holding", "segment", "senate", "house", "countdown", "kalshi", "sites", "site", "media", "mediashow", "senatemap", "govmap", "housemap"];

export function freshState() {
  return {
    version: 1,
    screen: "home",
    live: {
      raceId: "oh-sen",
      segmentId: "standby",
      marketId: DEFAULT_KALSHI_MARKET.id,
      siteId: null,
      mediaId: null,
      mapState: "OH"
    },
    settings: {
      electionDate: "2026-11-03",
      timezone: "America/New_York",
      hideMs: 8000,
      autoClosePolls: true,
      kalshiProxy: DEFAULT_KALSHI_PROXY,
      feedDate: "2026-11-03",
      categories: defaultCategories(),
      kalshiRefreshSec: 20,
      defaultsVersion: DEFAULTS_VERSION,
      applyCallsToControl: false,
      markup: {
        color: "#ffe14a",
        size: 18,
        tool: "pen",
        autoClear: true
      }
    },
    brand: {
      title: "ELECTION NIGHT",
      show: "THE DAN BONGINO SHOW",
      logo: "LOGO"
    },
    senate: { r: 53, d: 47, i: 0, total: 100, majority: 51, subtitle: "CURRENT" },
    house: { r: 218, d: 214, i: 1, vacant: 2, total: 435, majority: 218, subtitle: "CURRENT" },
    races: RACES.map(clone),
    states: STATES.map(clone),
    segments: SEGMENTS.map(clone),
    markets: defaultMarkets(),
    sites: [],
    media: []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
