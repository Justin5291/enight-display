import { getState, update, setCall } from "./state.js";
import { el, clear, uid, statusLabel, resolvedStatus, formatClose } from "./util.js";
import { parseKalshiInput, pokeKalshi, getQuote } from "./kalshi.js";
import { markupOn, setOn, setMarkupListener } from "./markup.js";
import { putBlob, kindOf } from "./media-db.js";
import { getLiveVideo } from "./screen-media.js";

const SOURCES = [
  ["holding", "Hold"],
  ["segment", "Show"],
  ["senate", "Senate"],
  ["house", "House"],
  ["countdown", "Closes"],
  ["kalshi", "Kalshi"],
  ["sites", "Sites"],
  ["media", "Media"]
];

let op = null;
let onGear = () => {};
let note = "";

export function initOperator(opts) {
  op = document.getElementById("op");
  onGear = opts.onGear || onGear;
  setMarkupListener(() => {
    if (!op.hidden) build();
  });
}

export function operatorOpen() {
  return op && !op.hidden;
}

export function setOperatorOpen(open) {
  op.hidden = !open;
  document.body.classList.toggle("controls-open", !!open);
  if (open) build();
}

export function refreshOperator() {
  if (!op || op.hidden) return;
  const active = document.activeElement;
  if (active && op.contains(active) && active.matches("input, textarea, select")) {
    fillFigures();
    return;
  }
  const next = sig(getState());
  if (next !== op._sig) build();
  else fillFigures();
}

let toastTimer = null;

export function flash(message) {
  note = message || "";
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = note;
  toast.hidden = !note;
  clearTimeout(toastTimer);
  if (note) toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
}

function quoteError(s) {
  const quote = getQuote(s.live.marketId);
  return quote && quote.error ? quote.error : "";
}

function sig(s) {
  return [
    s.screen,
    s.live.raceId,
    s.live.segmentId,
    s.live.marketId,
    s.live.siteId,
    s.live.mediaId,
    s.live.mapState,
    s.races.map((r) => r.id + ":" + (r.calledId || "")).join(","),
    s.markets.map((m) => m.id + m.ticker).join(","),
    s.sites.map((site) => site.id + site.mode + site.name).join(","),
    s.media.map((m) => m.id + m.name).join(","),
    s.segments.map((g) => g.id).join(","),
    s.states.map((st) => st.abbr + st.status).join(""),
    s.settings.kalshiProxy ? "1" : "0",
    quoteError(s),
    markupOn() ? "d" : "o"
  ].join("|");
}

function build() {
  const s = getState();
  op._sig = sig(s);
  clear(op);
  op.appendChild(topRow(s));
  op.appendChild(sourceRow(s));
  op.appendChild(context(s));
  const slot = op.querySelector("[data-note]");
  if (slot) {
    slot.textContent = note;
    slot.hidden = !note;
  }
}

function topRow(s) {
  const row = el("div", { class: "op-top" });
  row.appendChild(el("div", { class: "op-title", text: labelFor(s.screen) }));
  const right = el("div", { class: "inline" });
  const draw = el("button", { type: "button", class: "bigbtn" + (markupOn() ? " on" : ""), text: markupOn() ? "Draw on" : "Draw" });
  draw.addEventListener("click", () => setOn(!markupOn()));
  const gear = el("button", { type: "button", class: "gear", "aria-label": "Settings" });
  gear.appendChild(gearIcon());
  gear.appendChild(document.createTextNode("Setup"));
  gear.addEventListener("click", () => onGear(sectionFor(s.screen)));
  const hide = el("button", { type: "button", class: "bigbtn", text: "Hide" });
  hide.addEventListener("click", () => setOperatorOpen(false));
  right.append(draw, gear, hide);
  row.appendChild(right);
  return row;
}

function sourceRow(s) {
  const row = el("div", { class: "op-sources" });
  for (const [id, label] of SOURCES) {
    const btn = el("button", { type: "button", class: "src-btn" + (sourceOn(s.screen, id) ? " on" : ""), text: label });
    btn.addEventListener("click", () => update((st) => { st.screen = id; }));
    row.appendChild(btn);
  }
  return row;
}

function sourceOn(screen, id) {
  if (id === "sites") return screen === "sites" || screen === "site";
  if (id === "media") return screen === "media" || screen === "mediashow";
  return screen === id;
}

function context(s) {
  const box = el("div", { class: "op-context" });
  const slot = el("div", { class: "warn", "data-note": "1" });
  slot.hidden = true;
  box.appendChild(slot);
  if (s.screen === "senate" || s.screen === "house") boardContext(box, s, s.screen);
  else if (s.screen === "map") mapContext(box, s);
  else if (s.screen === "call" || s.screen === "tally") raceContext(box, s);
  else if (s.screen === "segment" || s.screen === "holding") segmentContext(box, s);
  else if (s.screen === "countdown") countContext(box, s);
  else if (s.screen === "kalshi") kalshiContext(box, s);
  else if (s.screen === "sites" || s.screen === "site") sitesContext(box, s);
  else if (s.screen === "media" || s.screen === "mediashow") mediaContext(box, s);
  return box;
}

function boardContext(box, s, chamber) {
  const b = s[chamber];
  box.appendChild(stepper("R", "r", b.r, chamber));
  box.appendChild(stepper("D", "d", b.d, chamber));
  box.appendChild(stepper("I", "i", b.i, chamber));
  if (chamber === "house") box.appendChild(stepper("Vac", "vacant", b.vacant, chamber));
  const sub = el("button", { type: "button", class: "bigbtn", "data-fig": chamber + "-sub", text: b.subtitle });
  sub.addEventListener("click", () => update((st) => {
    const order = ["CURRENT", "PROJECTED", "CALLED"];
    const i = order.indexOf(st[chamber].subtitle);
    st[chamber].subtitle = order[(i + 1) % order.length];
  }));
  box.appendChild(sub);
  box.appendChild(zeroButton(chamber));
  const warn = el("div", { class: "warn", "data-fig": chamber + "-over", text: overText(b) });
  warn.hidden = !overText(b);
  box.appendChild(warn);
}

function stepper(label, key, value, chamber) {
  const wrap = el("div", { class: "stepper " + (key === "r" ? "r" : key === "d" ? "d" : "") });
  wrap.appendChild(holdButton("−", "", () => stepSeat(chamber, key, -1)));
  const val = el("div", { class: "stepper-val" }, [
    el("b", { "data-fig": chamber + "-" + key, text: String(value) }),
    el("span", { text: label })
  ]);
  wrap.appendChild(val);
  wrap.appendChild(holdButton("+", "", () => stepSeat(chamber, key, 1)));
  return wrap;
}

function stepSeat(chamber, key, delta) {
  update((s) => {
    s[chamber][key] = Math.max(0, (Number(s[chamber][key]) || 0) + delta);
  });
}

function zeroButton(chamber) {
  const btn = el("button", { type: "button", class: "bigbtn danger", text: "Zero" });
  let arm = 0;
  btn.addEventListener("click", () => {
    if (Date.now() - arm > 2500) {
      arm = Date.now();
      btn.textContent = "Tap again";
      return;
    }
    arm = 0;
    btn.textContent = "Zero";
    update((s) => {
      s[chamber].r = 0;
      s[chamber].d = 0;
      s[chamber].i = 0;
      if (chamber === "house") s[chamber].vacant = 0;
      s[chamber].subtitle = "PROJECTED";
      for (const race of s.races) {
        if (race.control === chamber) race.controlApplied = null;
      }
    });
  });
  return btn;
}

function mapContext(box, s) {
  const st = s.states.find((row) => row.abbr === s.live.mapState);
  if (!st) return;
  const now = Date.now();
  const status = resolvedStatus(st, s.settings, now);
  box.appendChild(el("div", { class: "race-switch-name", "data-fig": "map-name", text: st.abbr + "  " + formatClose(st.closeMin) }));
  const options = [["auto", "Auto"], ["open", "Not closed"], ["closed", "Closed"], ["early", "Too early"], ["R", "Call R"], ["D", "Call D"]];
  for (const [id, label] of options) {
    const btn = el("button", { type: "button", class: "bigbtn" + (st.status === id ? " on" : ""), text: label });
    btn.addEventListener("click", () => update((state) => {
      const row = state.states.find((item) => item.abbr === state.live.mapState);
      if (row) row.status = id;
    }));
    box.appendChild(btn);
  }
  const bits = [];
  if (!st.verified) bits.push("Close time is unverified.");
  if (st.note) bits.push(st.note);
  bits.push("Showing " + statusLabel(status) + ".");
  box.appendChild(el("div", { class: "warn", text: bits.join(" ") }));
}

function raceContext(box, s) {
  box.appendChild(raceSwitch(s));
  const race = s.races.find((r) => r.id === s.live.raceId);
  if (!race) return;
  for (const cand of race.candidates) {
    const on = race.calledId === cand.id;
    const btn = el("button", {
      type: "button",
      class: "bigbtn " + cand.party + (on ? " on" : ""),
      text: (on ? "CALLED " : "CALL ") + cand.name
    });
    btn.addEventListener("click", () => setCall(race.id, cand.id));
    box.appendChild(btn);
  }
  const un = el("button", { type: "button", class: "bigbtn", text: "Uncall" });
  un.addEventListener("click", () => setCall(race.id, null));
  box.appendChild(un);
  if (s.screen === "tally") {
    const reporting = el("input", { class: "op-input", type: "number", min: "0", max: "100", value: String(race.reporting), "aria-label": "Percent reporting" });
    reporting.addEventListener("change", () => update((st) => {
      const row = st.races.find((r) => r.id === race.id);
      if (row) row.reporting = Number(reporting.value);
    }));
    box.appendChild(reporting);
    for (const cand of race.candidates) {
      const input = el("input", { class: "op-input", type: "number", min: "0", value: String(cand.votes), "aria-label": cand.name + " votes" });
      input.addEventListener("change", () => update((st) => {
        const row = st.races.find((r) => r.id === race.id);
        const person = row && row.candidates.find((c) => c.id === cand.id);
        if (person) person.votes = Number(input.value);
      }));
      box.appendChild(input);
    }
  }
}

function raceSwitch(s) {
  const race = s.races.find((r) => r.id === s.live.raceId);
  const wrap = el("div", { class: "race-switch" });
  wrap.appendChild(el("button", { type: "button", class: "bigbtn", text: "‹", onClick: () => stepRace(-1) }));
  wrap.appendChild(el("div", { class: "race-switch-name", text: race ? race.title : "No race" }));
  wrap.appendChild(el("button", { type: "button", class: "bigbtn", text: "›", onClick: () => stepRace(1) }));
  return wrap;
}

function stepRace(dir) {
  update((s) => {
    if (!s.races.length) return;
    let i = s.races.findIndex((r) => r.id === s.live.raceId);
    if (i < 0) i = 0;
    const j = (i + dir + s.races.length) % s.races.length;
    s.live.raceId = s.races[j].id;
  });
}

function segmentContext(box, s) {
  box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Prev", onClick: () => stepSeg(-1) }));
  box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Next", onClick: () => stepSeg(1) }));
  for (const seg of s.segments) {
    const btn = el("button", { type: "button", class: "src-btn" + (seg.id === s.live.segmentId ? " on" : ""), text: seg.code || seg.time });
    btn.addEventListener("click", () => update((st) => {
      st.live.segmentId = seg.id;
      st.screen = "segment";
    }));
    box.appendChild(btn);
  }
}

function stepSeg(dir) {
  update((s) => {
    if (!s.segments.length) return;
    let i = s.segments.findIndex((g) => g.id === s.live.segmentId);
    if (i < 0) i = 0;
    const j = (i + dir + s.segments.length) % s.segments.length;
    s.live.segmentId = s.segments[j].id;
    s.screen = "segment";
  });
}

function countContext(box, s) {
  box.appendChild(el("div", { class: "warn", text: "Election date " + s.settings.electionDate + ". Times without a check in Setup are unverified. Use today for rehearsal." }));
}

function kalshiContext(box, s) {
  if (!s.settings.kalshiProxy) {
    box.appendChild(el("div", { class: "warn", text: "Kalshi needs a proxy. The iPad cannot call Kalshi directly (the API returns 403 with no CORS headers)." }));
    box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Set proxy", onClick: () => onGear("kalshi") }));
  }
  const input = el("input", { class: "op-input", type: "text", placeholder: "Ticker or kalshi.com URL" });
  const add = el("button", { type: "button", class: "bigbtn", text: "Add" });
  add.addEventListener("click", () => {
    const parsed = parseKalshiInput(input.value);
    if (!parsed) {
      note = "Could not read a ticker from that.";
      build();
      return;
    }
    note = "";
    update((st) => {
      const id = uid("kx");
      st.markets.push({ id: id, ticker: parsed.ticker, series: parsed.series, label: parsed.ticker, sourceUrl: parsed.sourceUrl, range: "ALL" });
      st.live.marketId = id;
      st.screen = "kalshi";
    });
    pokeKalshi();
  });
  box.appendChild(input);
  box.appendChild(add);
  for (const market of s.markets) {
    const btn = el("button", { type: "button", class: "src-btn" + (market.id === s.live.marketId ? " on" : ""), text: market.label || market.ticker });
    btn.addEventListener("click", () => {
      update((st) => {
        st.live.marketId = market.id;
        st.screen = "kalshi";
      });
      pokeKalshi();
    });
    box.appendChild(btn);
  }
  const quote = getQuote(s.live.marketId);
  if (quote && quote.error && quote.error !== "proxy") {
    const stale = quote.outcomes && quote.outcomes.length;
    const text = stale ? "Kalshi refresh failed. Still showing the last update." : "Kalshi: " + quote.error;
    box.appendChild(el("div", { class: "warn", text: text }));
  }
  const open = el("button", { type: "button", class: "bigbtn", text: "Open Kalshi in Safari" });
  open.addEventListener("click", () => {
    const market = s.markets.find((m) => m.id === s.live.marketId);
    const url = (market && market.sourceUrl) || "https://kalshi.com/";
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) {
      note = "Safari did not open. Tap again.";
      build();
    }
  });
  box.appendChild(open);
}

function sitesContext(box, s) {
  if (s.screen === "sites") {
    box.appendChild(el("div", { class: "warn", text: "Tap a tile. Embed sites fill the screen. Safari sites leave the app — come back with the E-Night icon." }));
    return;
  }
  const site = s.sites.find((row) => row.id === s.live.siteId);
  box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Dashboard", onClick: () => update((st) => { st.screen = "sites"; }) }));
  if (!site) return;
  box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Safari", onClick: () => {
    const opened = window.open(site.url, "_blank", "noopener");
    if (!opened) {
      note = "Safari did not open. Tap again.";
      build();
    }
  } }));
  const slider = el("input", { type: "range", min: "0.4", max: "4", step: "0.05", value: String(site.scale), "data-scale": "1", "aria-label": "Zoom" });
  slider.addEventListener("input", () => update((st) => {
    const row = st.sites.find((item) => item.id === site.id);
    if (row) row.scale = Number(slider.value);
  }));
  box.appendChild(slider);
  box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Reset frame", onClick: () => update((st) => {
    const row = st.sites.find((item) => item.id === site.id);
    if (!row) return;
    row.scale = 1;
    row.x = 0;
    row.y = 0;
  }) }));
  box.appendChild(el("div", { class: "warn", text: "Drag and pinch to frame. The frame saves for this site." }));
}

function mediaContext(box, s) {
  const file = el("input", { type: "file", accept: "image/*,video/*,application/pdf", multiple: true });
  file.hidden = true;
  file.addEventListener("change", () => {
    const list = [...file.files];
    file.value = "";
    addFiles(list);
  });
  box.appendChild(file);
  box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Add files", onClick: () => file.click() }));
  const url = el("input", { class: "op-input", type: "url", placeholder: "Image, video, or PDF URL" });
  const add = el("button", { type: "button", class: "bigbtn", text: "Add URL" });
  add.addEventListener("click", () => {
    const value = url.value.trim();
    if (!/^https?:\/\//i.test(value)) {
      note = "Use a full http(s) link.";
      build();
      return;
    }
    update((st) => {
      const id = uid("media");
      st.media.push({ id: id, name: value.replace(/^https?:\/\//, "").slice(0, 42), kind: kindOf("", value), mime: "", url: value });
      st.live.mediaId = id;
      st.screen = "mediashow";
    });
    note = "";
  });
  box.appendChild(url);
  box.appendChild(add);
  for (const item of s.media) {
    const btn = el("button", { type: "button", class: "src-btn" + (item.id === s.live.mediaId && s.screen === "mediashow" ? " on" : ""), text: item.name || "Graphic" });
    btn.addEventListener("click", () => update((st) => {
      st.live.mediaId = item.id;
      st.screen = "mediashow";
    }));
    box.appendChild(btn);
  }
  const live = s.media.find((m) => m.id === s.live.mediaId);
  if (s.screen === "mediashow" && live && live.kind === "video") {
    box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Play", onClick: () => { const v = getLiveVideo(); if (v) v.play().catch(() => {}); } }));
    box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Pause", onClick: () => { const v = getLiveVideo(); if (v) v.pause(); } }));
    box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Mute", onClick: () => { const v = getLiveVideo(); if (v) v.muted = !v.muted; } }));
  }
  box.appendChild(el("button", { type: "button", class: "bigbtn", text: "Library", onClick: () => update((st) => { st.screen = "media"; }) }));
}

async function addFiles(list) {
  for (const file of list) {
    const id = uid("media");
    try {
      await putBlob(id, file);
    } catch (e) {
      note = "Could not store " + file.name;
      build();
      return;
    }
    const name = file.name.replace(/\.[^.]+$/, "") || file.name;
    update((s) => {
      s.media.push({ id: id, name: name, kind: kindOf(file.type, file.name), mime: file.type || "", url: "" });
      s.live.mediaId = id;
      s.screen = "mediashow";
    });
  }
  note = "";
}

function fillFigures() {
  const s = getState();
  op.querySelectorAll("[data-fig]").forEach((n) => {
    const val = figure(s, n.getAttribute("data-fig"));
    if (val == null) return;
    if (n.textContent !== val) n.textContent = val;
    if (n.classList.contains("warn")) n.hidden = !val;
  });
  const scale = op.querySelector("[data-scale]");
  if (scale && document.activeElement !== scale) {
    const site = s.sites.find((row) => row.id === s.live.siteId);
    if (site) scale.value = String(site.scale);
  }
}

function figure(s, key) {
  const board = key.startsWith("senate") ? s.senate : key.startsWith("house") ? s.house : null;
  if (key.endsWith("-r") && board) return String(board.r);
  if (key.endsWith("-d") && board) return String(board.d);
  if (key.endsWith("-i") && board) return String(board.i);
  if (key.endsWith("-vacant") && board) return String(board.vacant || 0);
  if (key.endsWith("-sub") && board) return board.subtitle;
  if (key.endsWith("-over") && board) return overText(board);
  if (key === "map-name") {
    const st = s.states.find((row) => row.abbr === s.live.mapState);
    return st ? st.abbr + "  " + formatClose(st.closeMin) : "";
  }
  return null;
}

function overText(b) {
  const sum = (Number(b.r) || 0) + (Number(b.d) || 0) + (Number(b.i) || 0) + (Number(b.vacant) || 0);
  if (sum > b.total) return "Seats add up past " + b.total + ".";
  return "";
}

function holdButton(label, cls, fn) {
  const btn = el("button", { type: "button", class: cls || "", text: label });
  let timer = null;
  const stop = () => { clearTimeout(timer); timer = null; };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    fn();
    let wait = 380;
    const kick = () => {
      timer = setTimeout(() => {
        fn();
        wait = 70;
        kick();
      }, wait);
    };
    kick();
  });
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointerleave", stop);
  btn.addEventListener("pointercancel", stop);
  return btn;
}

function labelFor(screen) {
  const names = {
    holding: "Holding",
    segment: "Show",
    senate: "Senate",
    house: "House",
    map: "Map",
    call: "Race call",
    tally: "Tally",
    countdown: "Poll closes",
    kalshi: "Kalshi",
    sites: "Sites",
    site: "Website",
    media: "Media",
    mediashow: "Graphic"
  };
  return names[screen] || "Controls";
}

function sectionFor(screen) {
  if (screen === "senate" || screen === "house") return screen;
  if (screen === "map" || screen === "countdown") return "states";
  if (screen === "call" || screen === "tally") return "races";
  if (screen === "segment" || screen === "holding") return "segments";
  if (screen === "kalshi") return "kalshi";
  if (screen === "sites" || screen === "site") return "sites";
  if (screen === "media" || screen === "mediashow") return "media";
  return "show";
}

function gearIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(ns, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "18");
  icon.setAttribute("height", "18");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("d", "M19.4 13.5a7.7 7.7 0 0 0 .1-1.5 7.7 7.7 0 0 0-.1-1.5l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5l-.4-2.6h-4l-.4 2.6a7.4 7.4 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0-.1 1.5 7.7 7.7 0 0 0 .1 1.5l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.6zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z");
  icon.appendChild(path);
  return icon;
}
