import { getState, update } from "./state.js";
import { el, clear, starsLabel, faviconFor, uid } from "./util.js";
import { getSeats } from "./nyt.js";
import { getQuote, parseKalshiInput, pokeKalshi, resolveBoard } from "./kalshi.js";
import { putBlob, kindOf, mediaSrc } from "./media-db.js";
import { goPage } from "./pages.js";
import { openSite } from "./screen-sites.js";
import { flash } from "./operator.js";

const snaps = new Map();
let homeNode = null;
let quoteTimer = null;
let pulling = false;

export function mountHome(node, state) {
  homeNode = node;
  paint(node, state);
  node._patch = (s) => {
    if (homeNode !== node) return;
    const sig = structureSig(s);
    if (sig !== node._sig) {
      node._sig = sig;
      paint(node, s);
      return;
    }
    fillLive(node);
  };
  refreshQuotes();
  if (!quoteTimer) quoteTimer = setInterval(refreshQuotes, 20000);
}

function paint(node, state) {
  node._sig = structureSig(state);
  clear(node);
  const scroll = el("div", { class: "dash-scroll" });
  scroll.appendChild(starsLabel(state.brand.title || "ELECTION NIGHT"));
  let any = false;
  const cats = state.settings.categories || {};
  if (cats.seats) { any = true; scroll.appendChild(seatSection()); }
  if (cats.show) { any = true; scroll.appendChild(showSection(state)); }
  if (cats.kalshi) { any = true; scroll.appendChild(kalshiSection(state)); }
  if (cats.sites) { any = true; scroll.appendChild(sitesSection(state)); }
  if (cats.media) { any = true; scroll.appendChild(mediaSection(state)); }
  if (cats.map) { any = true; scroll.appendChild(singleSection("Map", textTile("States", "MAP", () => goPage({ screen: "map", key: "map", label: "Map" })))); }
  if (cats.races) { any = true; scroll.appendChild(raceSection(state)); }
  if (cats.countdown) { any = true; scroll.appendChild(singleSection("Poll closes", textTile("Poll closes", "CLOCK", () => goPage({ screen: "countdown", key: "countdown", label: "Closes" })))); }
  if (cats.manual) { any = true; scroll.appendChild(manualSection()); }
  if (!any) scroll.appendChild(el("p", { class: "home-empty", text: "Every section is off. Turn sections on in Setup." }));
  node.appendChild(el("div", { class: "dash" }, [scroll]));
  fillLive(node);
}

function structureSig(s) {
  const c = s.settings.categories || {};
  return [
    s.brand.title,
    Object.keys(c).map((k) => k + (c[k] ? 1 : 0)).join(","),
    s.markets.map((m) => m.id + ":" + (m.label || "") + ":" + (m.ticker || "")).join(","),
    s.sites.map((site) => [site.id, site.name, site.mode, site.group, site.url].join(":")).join("|"),
    s.media.map((m) => [m.id, m.name, m.kind].join(":")).join("|"),
    s.segments.map((g) => g.id + (g.code || "") + (g.title || "")).join("|"),
    s.races.map((r) => r.id + (r.short || "") + (r.title || "")).join("|")
  ].join("||");
}

function section(title, body) {
  return el("section", { class: "home-sec" }, [
    el("div", { class: "home-head" }, [el("div", { class: "home-label", text: title })]),
    body
  ]);
}

function singleSection(title, tile) {
  return section(title, el("div", { class: "tile-grid" }, [tile]));
}

function seatSection() {
  return section("Seat trackers", el("div", { class: "tile-grid" }, [
    seatTile("senate", "Senate"),
    seatTile("house", "House")
  ]));
}

function seatTile(chamber, name) {
  const btn = el("button", { type: "button", class: "tile-btn", onClick: () => goPage({ screen: chamber, key: chamber, label: name }) });
  btn.appendChild(el("div", { class: "tile-mark", text: chamber === "senate" ? "S" : "H" }));
  btn.appendChild(el("div", { class: "tile-name", text: name }));
  btn.appendChild(el("div", { class: "tile-mode", "data-live": "seat:" + chamber, text: seatBlurb(chamber) }));
  return btn;
}

function showSection(state) {
  const tiles = [textTile("Holding", "HOLD", () => goPage({ screen: "holding", key: "holding", label: "Holding" }))];
  for (const seg of state.segments) {
    tiles.push(textTile(seg.title || seg.code || "Segment", seg.code || "SHOW", () => goPage({
      screen: "segment",
      segmentId: seg.id,
      key: "segment:" + seg.id,
      label: seg.code || seg.title || "Show"
    })));
  }
  return section("Show", el("div", { class: "tile-grid" }, tiles));
}

function kalshiSection(state) {
  const input = el("input", { class: "home-input", type: "text", placeholder: "Ticker or kalshi.com URL", "aria-label": "Kalshi ticker" });
  const add = el("button", { type: "button", class: "home-add", text: "Add", onClick: () => addMarket(input) });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addMarket(input);
  });
  const grid = el("div", { class: "tile-grid" });
  for (const market of state.markets) grid.appendChild(kalshiTile(market));
  const body = el("div", { class: "home-block" }, [
    el("div", { class: "home-tools" }, [input, add]),
    state.markets.length ? grid : el("p", { class: "home-empty", text: "No markets yet" })
  ]);
  return section("Kalshi markets", body);
}

function kalshiTile(market) {
  const btn = el("button", {
    type: "button",
    class: "tile-btn",
    onClick: () => goPage({ screen: "kalshi", marketId: market.id, key: "kalshi:" + market.id, label: market.label || market.ticker })
  });
  btn.appendChild(el("div", { class: "tile-pct", "data-live": "kx:" + market.id, text: kxPct(market) }));
  btn.appendChild(el("div", { class: "tile-name", "data-live": "kxtitle:" + market.id, text: kxTitle(market) }));
  btn.appendChild(el("div", { class: "tile-mode", "data-live": "kxsub:" + market.id, text: kxSub(market) }));
  return btn;
}

function sitesSection(state) {
  const wrap = el("div", { class: "home-block" });
  if (!state.sites.length) {
    wrap.appendChild(el("p", { class: "home-empty", text: "No sites yet" }));
    return section("Websites", wrap);
  }
  let group = null;
  let grid = null;
  for (const site of state.sites) {
    const name = site.group || "Other";
    if (name !== group) {
      group = name;
      wrap.appendChild(el("div", { class: "group-name", text: group }));
      grid = el("div", { class: "tile-grid" });
      wrap.appendChild(grid);
    }
    grid.appendChild(siteTile(site));
  }
  return section("Websites", wrap);
}

function siteTile(site) {
  const btn = el("button", { type: "button", class: "tile-btn", onClick: () => openSite(site.id) });
  btn.appendChild(siteMark(site));
  btn.appendChild(el("div", { class: "tile-name", text: site.name }));
  btn.appendChild(el("div", { class: "tile-mode", text: site.mode === "embed" ? "EMBED" : "SAFARI" }));
  return btn;
}

function siteMark(site) {
  const mark = el("div", { class: "tile-mark icon", text: letter(site.name) });
  const src = faviconFor(site.url);
  if (!src) return mark;
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  img.referrerPolicy = "no-referrer";
  img.addEventListener("load", () => {
    mark.textContent = "";
    mark.appendChild(img);
  });
  img.addEventListener("error", () => {});
  img.src = src;
  return mark;
}

function mediaSection(state) {
  const file = el("input", { type: "file", accept: "image/*,video/*,application/pdf", multiple: true });
  file.hidden = true;
  file.addEventListener("change", () => {
    const list = [...file.files];
    file.value = "";
    addFiles(list);
  });
  const grid = el("div", { class: "tile-grid" });
  for (const item of state.media) grid.appendChild(mediaTile(item));
  const body = el("div", { class: "home-block" }, [
    el("div", { class: "home-tools" }, [
      file,
      el("button", { type: "button", class: "home-add", text: "Add files", onClick: () => file.click() })
    ]),
    state.media.length ? grid : el("p", { class: "home-empty", text: "No graphics yet" })
  ]);
  return section("Graphics / Media", body);
}

function mediaTile(item) {
  const btn = el("button", {
    type: "button",
    class: "tile-btn",
    onClick: () => goPage({ screen: "mediashow", mediaId: item.id, key: "media:" + item.id, label: item.name || "Graphic" })
  });
  const mark = el("div", { class: "tile-mark", text: kindLetter(item) });
  btn.appendChild(mark);
  attachThumb(mark, item);
  btn.appendChild(el("div", { class: "tile-name", text: item.name || "Untitled" }));
  btn.appendChild(el("div", { class: "tile-mode", text: (item.kind || "file").toUpperCase() }));
  return btn;
}

function raceSection(state) {
  const tiles = [];
  for (const race of state.races) {
    const name = race.short || race.title || "Race";
    tiles.push(textTile(name, "CALL", () => goPage({
      screen: "call",
      raceId: race.id,
      key: "call:" + race.id,
      label: name + " call"
    })));
    tiles.push(textTile(name, "TALLY", () => goPage({
      screen: "tally",
      raceId: race.id,
      key: "tally:" + race.id,
      label: name + " tally"
    })));
  }
  const body = tiles.length
    ? el("div", { class: "tile-grid" }, tiles)
    : el("p", { class: "home-empty", text: "No races yet" });
  return section("Race calls / tallies", body);
}

function manualSection() {
  return section("Manual boards", el("div", { class: "tile-grid" }, [
    textTile("Senate", "MANUAL", () => goPage({ screen: "senateManual", key: "senateManual", label: "Senate manual" })),
    textTile("House", "MANUAL", () => goPage({ screen: "houseManual", key: "houseManual", label: "House manual" }))
  ]));
}

function textTile(name, mode, onClick) {
  const btn = el("button", { type: "button", class: "tile-btn", onClick: onClick });
  btn.appendChild(el("div", { class: "tile-mark", text: letter(name) }));
  btn.appendChild(el("div", { class: "tile-name", text: name }));
  if (mode) btn.appendChild(el("div", { class: "tile-mode", text: mode }));
  return btn;
}

function letter(name) {
  const ch = String(name || "?").trim().charAt(0);
  return ch.toUpperCase() || "?";
}

function kindLetter(item) {
  if (item.kind === "video") return "▶";
  if (item.kind === "pdf") return "PDF";
  if (item.kind === "page") return "WEB";
  return letter(item.name);
}

function attachThumb(mark, item) {
  if (item.kind !== "image" && item.kind !== "video") return;
  const token = {};
  mark._token = token;
  mediaSrc(item).then((src) => {
    if (mark._token !== token || !src || !mark.isConnected) return;
    if (item.kind === "image") {
      const img = document.createElement("img");
      img.className = "thumb";
      img.alt = "";
      img.draggable = false;
      img.addEventListener("load", () => {
        if (mark._token !== token) return;
        mark.textContent = "";
        mark.classList.add("shot");
        mark.appendChild(img);
      });
      img.src = src;
      return;
    }
    const video = document.createElement("video");
    video.className = "thumb";
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("loadeddata", () => {
      if (mark._token !== token) return;
      try { video.currentTime = 0.1; } catch (e) { /* some files refuse a seek */ }
      mark.textContent = "";
      mark.classList.add("shot");
      mark.appendChild(video);
    });
    video.src = src;
  }).catch(() => {});
}

function fillLive(node) {
  node.querySelectorAll("[data-live]").forEach((n) => {
    const text = liveText(n.getAttribute("data-live"));
    if (text != null && n.textContent !== text) n.textContent = text;
  });
}

function liveText(key) {
  if (!key) return null;
  if (key.indexOf("seat:") === 0) return seatBlurb(key.slice(5));
  if (key.indexOf("kx:") === 0) return kxPct({ id: key.slice(3) });
  if (key.indexOf("kxtitle:") === 0) return kxTitle(findMarket(key.slice(8)));
  if (key.indexOf("kxsub:") === 0) return kxSub(findMarket(key.slice(6)));
  return null;
}

function findMarket(id) {
  return getState().markets.find((m) => m.id === id) || { id: id, label: "", ticker: "" };
}

function seatBlurb(chamber) {
  const tally = getSeats(chamber);
  if (!tally) return "Waiting for calls";
  const bits = ["R " + tally.r, "D " + tally.d];
  if (tally.other > 0) bits.push("Other " + tally.other);
  bits.push(tally.called + "/" + tally.total);
  return bits.join("  ·  ");
}

function quoteBits(market) {
  const quote = market && getQuote(market.id);
  if (quote && quote.outcomes && quote.outcomes.length) {
    const top = quote.outcomes[0];
    return { pct: top.pct, name: top.name || "", title: quote.title || "" };
  }
  return snaps.get(market && market.id) || null;
}

function kxPct(market) {
  const bits = quoteBits(market);
  if (!bits || bits.pct == null || !Number.isFinite(Number(bits.pct))) return "—";
  return Math.round(Number(bits.pct)) + "%";
}

function kxTitle(market) {
  const bits = quoteBits(market);
  if (bits && bits.title) return bits.title;
  return (market && (market.label || market.ticker)) || "Market";
}

function kxSub(market) {
  const bits = quoteBits(market);
  if (!bits || !bits.name || bits.name === "YES") return bits && bits.name === "YES" ? "YES" : "";
  return bits.name;
}

function addMarket(input) {
  const parsed = parseKalshiInput(input.value);
  if (!parsed) {
    flash("Could not read a ticker from that.");
    return;
  }
  const id = uid("kx");
  update((st) => {
    st.markets.push({
      id: id,
      ticker: parsed.ticker,
      series: parsed.series,
      label: parsed.ticker,
      sourceUrl: parsed.sourceUrl,
      range: "ALL"
    });
    st.live.marketId = id;
    st.screen = "kalshi";
  });
  input.value = "";
  pokeKalshi();
}

async function addFiles(list) {
  for (const file of list) {
    const id = uid("media");
    try {
      await putBlob(id, file);
    } catch (e) {
      flash("Could not store " + (file.name || "that file") + ".");
      return;
    }
    const name = (file.name || "Graphic").replace(/\.[^.]+$/, "") || file.name;
    update((s) => {
      s.media.push({ id: id, name: name, kind: kindOf(file.type, file.name), mime: file.type || "", url: "" });
    });
  }
}

async function refreshQuotes() {
  if (pulling) return;
  const state = getState();
  if (!state.markets.length || !state.settings.kalshiProxy) return;
  if (typeof document !== "undefined" && document.hidden) return;
  pulling = true;
  try {
    await Promise.all(state.markets.map(async (market) => {
      if (!market.ticker) return;
      try {
        const board = await resolveBoard(state.settings.kalshiProxy, market.ticker);
        const top = board.outcomes && board.outcomes[0];
        snaps.set(market.id, {
          pct: top ? top.pct : null,
          name: top ? (top.name || "") : "",
          title: board.title || ""
        });
      } catch (e) { /* keep the last percent */ }
    }));
  } finally {
    pulling = false;
  }
  if (homeNode && homeNode.isConnected) fillLive(homeNode);
}
