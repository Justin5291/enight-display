import { TILES, SHOW_NOTES } from "./data.js";
import { update } from "./state.js";
import {
  el, svg, clear, topbar, needText, statusLabel, resolvedStatus,
  formatClose, pollSchedule, formatRemain
} from "./util.js";

export function mountSenate(node, state) {
  paintBoard(node, state, "senate");
  node._patch = (s) => paintBoard(node, s, "senate");
}

export function mountHouse(node, state) {
  paintBoard(node, state, "house");
  node._patch = (s) => paintBoard(node, s, "house");
}

function paintBoard(node, state, key) {
  const b = state[key];
  const name = key === "senate" ? "SENATE" : "HOUSE";
  const parts = barParts(b);
  clear(node);
  const rCard = partyCard("r", "REPUBLICANS", b.r, needText(b.r, b.majority));
  const dCard = partyCard("d", "DEMOCRATS", b.d, needText(b.d, b.majority));
  const track = el("div", { class: "track" }, [
    el("div", { class: "track-fill" }, [
      seg("r", parts.r), seg("i", parts.i), seg("v", parts.v), seg("u", parts.u), seg("d", parts.d)
    ])
  ]);
  const tickLeft = (b.majority / (parts.sum || 1) * 100);
  const wrap = el("div", { class: "track-wrap" }, [
    track,
    el("div", { class: "maj-tick", style: "left:" + tickLeft + "%" }),
    el("div", { class: "maj-tag", style: "left:" + tickLeft + "%", text: String(b.majority) })
  ]);
  const uncalled = Math.max(0, b.total - b.r - b.d - b.i - (b.vacant || 0));
  const footBits = ["Uncalled " + uncalled];
  if (b.i) footBits.push("Independent " + b.i);
  if (b.vacant) footBits.push("Vacant " + b.vacant);
  footBits.push(b.subtitle || "");
  const watch = el("div", { class: "watch" });
  const races = state.races.filter((r) => r.control === key);
  if (races.length) {
    watch.appendChild(el("span", { class: "rail-title", text: "ON THE BOARD" }));
    for (const race of races) {
      const called = (race.candidates || []).find((c) => c.id === race.calledId);
      const cls = called ? "chip " + called.party : "chip";
      const label = race.short + (called ? " " + called.party : "");
      watch.appendChild(el("span", { class: cls, text: label }));
    }
  }
  node.appendChild(topbar(state.brand, name));
  node.appendChild(el("div", { class: "board" }, [
    el("div", { class: "party-row" }, [rCard, dCard]),
    wrap,
    el("div", { class: "board-foot" }, [el("span", { text: footBits.filter(Boolean).join("   ·   ") })]),
    watch
  ]));
}

function partyCard(party, label, seats, need) {
  return el("div", { class: "party-card " + party }, [
    el("div", { class: "party-name", text: label }),
    el("div", { class: "seat-num", text: String(seats) }),
    el("div", { class: "need-line", text: need })
  ]);
}

function seg(kind, pct) {
  return el("i", { class: "seg " + kind, style: "width:" + pct.toFixed(3) + "%" });
}

function barParts(b) {
  const r = Math.max(0, Number(b.r) || 0);
  const d = Math.max(0, Number(b.d) || 0);
  const i = Math.max(0, Number(b.i) || 0);
  const v = Math.max(0, Number(b.vacant) || 0);
  const raw = r + d + i + v;
  const u = Math.max(0, (Number(b.total) || 0) - raw);
  const sum = r + d + i + v + u || 1;
  const pct = (n) => n / sum * 100;
  return { r: pct(r), d: pct(d), i: pct(i), v: pct(v), u: pct(u), sum: sum };
}

export function mountMap(node, state) {
  paintMap(node, state);
  node._patch = (s) => paintMap(node, s);
}

let downAt = 0;

function paintMap(node, state) {
  const now = Date.now();
  clear(node);
  const svgMap = buildMap(state, now);
  svgMap.addEventListener("pointerdown", () => { downAt = Date.now(); });
  svgMap.addEventListener("click", (e) => {
    if (Date.now() - downAt > 500) return;
    const g = e.target.closest("[data-st]");
    if (!g) return;
    if (!document.body.classList.contains("controls-open")) return;
    const abbr = g.getAttribute("data-st");
    update((s) => { s.live.mapState = abbr; });
  });
  const rail = el("div", { class: "map-rail" }, [
    el("div", { class: "rail-title", text: "WATCHING" })
  ]);
  const featured = state.states.filter((st) => st.featured).slice().sort((a, b) => a.closeMin - b.closeMin || a.abbr.localeCompare(b.abbr));
  for (const st of featured) {
    const status = resolvedStatus(st, state.settings, now);
    const clock = formatClose(st.closeMin).replace(" ET", "");
    rail.appendChild(el("div", { class: "rail-row" }, [
      el("i", { class: "dot " + status }),
      el("b", { text: st.abbr + "  " + clock }),
      el("span", { class: "rail-status", text: shortStatus(status) })
    ]));
  }
  const legend = el("div", { class: "legend" }, [
    leg("open", "Not closed"),
    leg("closed", "Closed"),
    leg("early", "Too early"),
    leg("R", "Called R"),
    leg("D", "Called D")
  ]);
  node.appendChild(topbar(state.brand, "MAP"));
  node.appendChild(el("div", { class: "map-layout" }, [svgMap, rail]));
  node.appendChild(legend);
}

function shortStatus(status) {
  if (status === "open") return "OPEN";
  if (status === "closed") return "CLOSED";
  if (status === "early") return "EARLY";
  if (status === "R" || status === "D") return status;
  return status;
}

function leg(status, label) {
  return el("span", {}, [el("i", { class: "dot " + status }), label]);
}

function buildMap(state, now) {
  const size = 78;
  const gap = 10;
  const cols = 11;
  const rows = 8;
  const vbW = cols * (size + gap) + gap;
  const vbH = rows * (size + gap) + gap;
  const root = svg("svg", { class: "map-svg", viewBox: "0 0 " + vbW + " " + vbH });
  for (const st of state.states) {
    const pos = TILES[st.abbr];
    if (!pos) continue;
    const status = resolvedStatus(st, state.settings, now);
    const x = gap + pos[0] * (size + gap);
    const y = gap + pos[1] * (size + gap);
    const cls = "tile-shape st-" + status + (st.featured ? " tile-featured" : "") + (st.abbr === state.live.mapState ? " tile-selected" : "");
    const g = svg("g", { "data-st": st.abbr }, [
      svg("rect", { class: cls, x: x, y: y, width: size, height: size, rx: 10 }),
      svg("text", { class: "tile-label", x: x + size / 2, y: y + size / 2 + 2, text: st.abbr })
    ]);
    root.appendChild(g);
  }
  return root;
}

export function mountCountdown(node, state) {
  paintCount(node, state, Date.now());
  node._patch = (s) => paintCount(node, s, Date.now());
  node._tick = (s) => {
    const now = Date.now();
    const sched = pollSchedule(s.states, s.settings.electionDate, s.settings.timezone, now);
    if (node._next !== (sched.nextTime || "done")) {
      paintCount(node, s, now);
      return;
    }
    const clock = node.querySelector("[data-clock]");
    if (clock && !sched.done) clock.textContent = sched.closingNow ? "00:00:00" : formatRemain(sched.nextTime - now);
    const flag = node.querySelector("[data-flag]");
    if (flag) flag.textContent = sched.done ? "POLLS CLOSED" : (sched.closingNow ? "POLLS CLOSING" : "NEXT POLL CLOSE");
  };
}

function paintCount(node, state, now) {
  const sched = pollSchedule(state.states, state.settings.electionDate, state.settings.timezone, now);
  node._next = sched.nextTime || "done";
  clear(node);
  node.appendChild(topbar(state.brand, "POLL CLOSES"));
  const body = el("div", { class: "count" });
  if (sched.done) {
    body.appendChild(el("div", { class: "kicker", "data-flag": "1", text: "POLLS CLOSED" }));
    body.appendChild(el("div", { class: "h-display silver", text: "ALL CLOSED" }));
    body.appendChild(el("p", { class: "subhead", text: "Scheduled poll closes have passed" }));
  } else {
    const sample = sched.states[0];
    let when = formatClose(sample.closeMin);
    const remain = sched.nextTime - now;
    if (remain > 18 * 3600 * 1000) when += "   ·   " + state.settings.electionDate;
    body.appendChild(el("div", { class: "kicker", "data-flag": "1", text: sched.closingNow ? "POLLS CLOSING" : "NEXT POLL CLOSE" }));
    body.appendChild(el("div", { class: "count-clock silver", "data-clock": "1", text: sched.closingNow ? "00:00:00" : formatRemain(remain) }));
    body.appendChild(el("div", { class: "count-when subhead", text: when }));
    const chips = el("div", { class: "count-states" });
    const list = sched.states.slice().sort((a, b) => Number(b.featured) - Number(a.featured) || a.abbr.localeCompare(b.abbr));
    for (const st of list) chips.appendChild(el("span", { class: "chip", text: st.featured ? "★ " + st.abbr : st.abbr }));
    body.appendChild(chips);
    if (sched.upcoming.length) {
      const lines = sched.upcoming.map((g) => formatClose(g.states[0].closeMin) + "  " + g.states.map((st) => st.abbr).join(" "));
      body.appendChild(el("div", { class: "count-next", text: lines.join("    ·    ") }));
    }
  }
  body.appendChild(el("div", { class: "footnotes", text: SHOW_NOTES }));
  node.appendChild(body);
}
