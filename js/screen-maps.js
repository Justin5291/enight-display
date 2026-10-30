/* Live results maps: Senate, Governor, House (state-level summary).
   Fill comes from AP calls in the NYT results feed (js/nyt.js).
   Shapes are vendored in js/us-states.js, so nothing loads from a CDN. */
import { el, svg, clear, topbar, formatClock } from "./util.js";
import { getSeats, getStateMap } from "./nyt.js";
import { US_STATES } from "./us-states.js";

export const MAP_KINDS = {
  senatemap: { chamber: "senate", title: "SENATE MAP", label: "Senate map" },
  govmap: { chamber: "governor", title: "GOVERNOR MAP", label: "Governor map" },
  housemap: { chamber: "house", title: "HOUSE MAP", label: "House map" }
};

/* Small Northeast states get a labeled callout box to the right of the map. */
const CALLOUTS = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"];
const LABEL_NUDGE = { FL: [14, 6], LA: [-12, 0], MI: [12, 22], KY: [6, 2], VA: [10, 4], WV: [-4, 4], NY: [6, 0], ID: [0, 22], CA: [-10, 0], HI: [10, 8], AK: [0, 0], ME: [0, 0] };
const VIEW_W = 1060;
const VIEW_H = 610;

export function mountSenateMap(node, state) { mountKind(node, state, "senatemap"); }
export function mountGovMap(node, state) { mountKind(node, state, "govmap"); }
export function mountHouseMap(node, state) { mountKind(node, state, "housemap"); }

function mountKind(node, state, screen) {
  const kind = MAP_KINDS[screen];
  clear(node);
  node.appendChild(topbar(state.brand, kind.title));
  const shapes = {};
  const root = svg("svg", { class: "rmap-svg", viewBox: "0 0 " + VIEW_W + " " + VIEW_H, preserveAspectRatio: "xMidYMid meet" });
  root.appendChild(stripes());
  const land = svg("g", { class: "rmap-land" });
  const labels = svg("g", { class: "rmap-labels" });
  for (const abbr of Object.keys(US_STATES)) {
    const st = US_STATES[abbr];
    const path = svg("path", { d: st.d, class: "rmap-st mp-none", "data-st": abbr });
    land.appendChild(path);
    shapes[abbr] = [path];
    if (CALLOUTS.includes(abbr)) continue;
    const nudge = LABEL_NUDGE[abbr] || [0, 0];
    labels.appendChild(svg("text", { class: "rmap-label", x: st.x + nudge[0], y: st.y + nudge[1], text: abbr }));
  }
  root.appendChild(land);
  root.appendChild(labels);
  const call = svg("g", { class: "rmap-callouts" });
  CALLOUTS.forEach((abbr, i) => {
    const y = 150 + i * 34;
    const box = svg("rect", { class: "rmap-st mp-none", x: 990, y: y, width: 58, height: 28, rx: 5 });
    call.appendChild(box);
    call.appendChild(svg("text", { class: "rmap-label small", x: 1019, y: y + 14, text: abbr }));
    if (shapes[abbr]) shapes[abbr].push(box);
  });
  root.appendChild(call);
  const counts = el("div", { class: "rmap-counts" });
  const updated = el("div", { class: "rmap-updated" });
  const legend = el("div", { class: "rmap-legend" }, [
    leg("mp-R", "Republican"),
    leg("mp-D", "Democrat"),
    leg("mp-O", "Ind / Other"),
    leg("mp-split", "Split"),
    leg("mp-pending", "Not called"),
    leg("mp-none", kind.chamber === "house" ? "No race" : "Not up")
  ]);
  if (kind.chamber === "house") legend.appendChild(leg("mp-R mp-partial", "Partly called"));
  node.appendChild(el("div", { class: "rmap" }, [
    el("div", { class: "rmap-top" }, [counts, updated]),
    el("div", { class: "rmap-stage" }, [root]),
    el("div", { class: "rmap-foot" }, [legend, el("div", { class: "seat-credit", text: "Race calls: AP via NYT" })])
  ]));
  const paint = (s) => {
    const map = getStateMap(kind.chamber);
    const tally = getSeats(kind.chamber);
    for (const abbr of Object.keys(shapes)) {
      const row = map && map[abbr];
      let cls = "mp-none";
      if (row) cls = "mp-" + row.party + (row.partial ? " mp-partial" : "");
      for (const shape of shapes[abbr]) {
        const next = "rmap-st " + cls;
        if (shape.getAttribute("class") !== next) shape.setAttribute("class", next);
      }
    }
    clear(counts);
    if (tally) {
      counts.appendChild(countChip("r", "R", tally.r));
      counts.appendChild(countChip("d", "D", tally.d));
      if (tally.other > 0) counts.appendChild(countChip("o", "IND", tally.other));
      counts.appendChild(el("span", { class: "rmap-called", text: tally.called + " of " + tally.total + " races called" }));
    } else {
      counts.appendChild(el("span", { class: "rmap-called", text: "Waiting for calls" }));
    }
    const tz = (s && s.settings && s.settings.timezone) || "America/New_York";
    const clock = tally && tally.updated ? formatClock(tally.updated, tz).replace(/[\u202f\u00a0]/g, " ") : "";
    updated.textContent = clock ? "Updated " + clock + (tz === "America/New_York" ? " ET" : "") : "";
  };
  paint(state);
  node._patch = paint;
}

function stripes() {
  return svg("defs", {}, [
    svg("pattern", { id: "mp-split-pat", width: 12, height: 12, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, [
      svg("rect", { width: 6, height: 12, fill: "#c41820" }),
      svg("rect", { x: 6, width: 6, height: 12, fill: "#1d4ed8" })
    ])
  ]);
}

function leg(cls, label) {
  return el("span", { class: "rmap-leg" }, [el("i", { class: "rmap-key " + cls }), label]);
}

function countChip(party, label, n) {
  return el("span", { class: "rmap-count " + party }, [el("b", { text: String(n) }), el("span", { text: label })]);
}

export function mapBlurb(screen) {
  const kind = MAP_KINDS[screen];
  const tally = kind && getSeats(kind.chamber);
  if (!tally) return "Waiting for calls";
  const bits = ["R " + tally.r, "D " + tally.d];
  if (tally.other > 0) bits.push("Other " + tally.other);
  bits.push(tally.called + "/" + tally.total);
  return bits.join("  ·  ");
}
