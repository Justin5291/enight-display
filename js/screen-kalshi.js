import { el, svg, clear, topbar, starsLabel, clamp, kalshiLogo, formatClock } from "./util.js";
import { getQuote, normalizeRange, pokeKalshi } from "./kalshi.js";
import { update } from "./state.js";

const RANGE_KEYS = ["1H", "1D", "1W", "1M", "ALL"];

export function mountKalshi(node, state) {
  paint(node, state);
  node._patch = (s) => {
    if (sigOf(s) === node._sig && node.firstChild) return;
    paint(node, s);
  };
}

function sigOf(state) {
  const market = state.markets.find((m) => m.id === state.live.marketId) || null;
  const quote = market ? getQuote(market.id) || {} : {};
  const parts = [
    state.live.marketId,
    market ? market.label : "",
    market ? market.range || "ALL" : "",
    state.brand.title,
    state.settings.timezone,
    quote.updated || 0,
    quote.candlesAt || 0,
    quote.title || "",
    quote.category || "",
    quote.subtitle || "",
    quote.kind || "",
    quote.range || ""
  ];
  const outcomes = quote.outcomes || [];
  for (let i = 0; i < outcomes.length; i++) {
    const o = outcomes[i];
    parts.push(
      o.ticker,
      o.name,
      o.color,
      o.pct == null ? "" : Math.round(o.pct * 10),
      o.change == null ? "" : Math.round(o.change),
      o.points ? o.points.length : 0
    );
  }
  return parts.join("|");
}

function paint(node, state) {
  const market = state.markets.find((m) => m.id === state.live.marketId) || null;
  const quote = market ? getQuote(market.id) : null;
  node._sig = sigOf(state);
  clear(node);
  node.appendChild(topbar(state.brand, "KALSHI"));
  if (!market) {
    node.appendChild(el("div", { class: "kx-empty" }, [
      kalshiLogo("lg"),
      starsLabel("KALSHI"),
      el("h1", { class: "h-display silver", text: "MARKETS" })
    ]));
    return;
  }
  const outcomes = quote && Array.isArray(quote.outcomes) ? quote.outcomes : [];
  const title = (quote && quote.title) || market.label || market.ticker;
  const cat = categoryText(quote);
  const range = (quote && quote.range) || market.range || "ALL";
  const head = el("div", { class: "kx-head" }, [
    el("div", { class: "kx-title-row" }, [
      kalshiLogo("lg"),
      el("h1", { class: "kx-title", text: title })
    ]),
    el("div", { class: "kx-tools" }, [
      el("div", { class: "kx-cat", text: cat }),
      rangeBar(market),
      updatedEl(quote, state.settings.timezone)
    ])
  ]);
  const chart = el("div", { class: "kx-chart" }, [
    sponsorMark(),
    chartSvg(outcomes, range, state.settings.timezone)
  ]);
  const table = el("div", { class: "kx-table" + (outcomes.length === 1 ? " one" : "") }, outcomes.map(outcomeRow));
  node.appendChild(el("div", { class: "kx" }, [head, chart, table]));
}

function sponsorMark() {
  return el("div", { class: "kx-sponsor" }, [
    el("span", { class: "kx-sponsor-label", text: "Sponsored by:" }),
    kalshiLogo("chart")
  ]);
}

function rangeBar(market) {
  const current = normalizeRange(market.range);
  const bar = el("div", { class: "kx-ranges", role: "group", "aria-label": "Chart range" });
  for (const key of RANGE_KEYS) {
    const btn = el("button", {
      type: "button",
      class: "kx-range" + (key === current ? " on" : ""),
      text: key,
      "aria-pressed": key === current ? "true" : "false"
    });
    btn.addEventListener("click", () => {
      if (normalizeRange(market.range) === key) return;
      update((st) => {
        const row = st.markets.find((m) => m.id === market.id);
        if (row) row.range = key;
      });
      pokeKalshi();
    });
    bar.appendChild(btn);
  }
  return bar;
}

function updatedEl(quote, timeZone) {
  const text = quote && quote.updated ? updatedText(quote.updated, timeZone) : "";
  const node = el("div", { class: "kx-updated", text: text });
  if (!text) node.hidden = true;
  return node;
}

function updatedText(ms, timeZone) {
  const tz = timeZone || "America/New_York";
  const clock = formatClock(ms, tz).replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
  if (!clock) return "";
  return "Updated " + clock + " " + zoneTag(tz);
}

function zoneTag(timeZone) {
  if (timeZone === "America/New_York" || timeZone === "US/Eastern") return "ET";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timeZone, timeZoneName: "short" }).formatToParts(new Date());
    const name = parts.find((part) => part.type === "timeZoneName");
    return name && name.value ? name.value : "ET";
  } catch (e) {
    return "ET";
  }
}

function categoryText(quote) {
  if (!quote) return "";
  const parts = [];
  if (quote.category) parts.push(String(quote.category));
  if (quote.subtitle) parts.push(String(quote.subtitle));
  return parts.join("  /  ");
}

function outcomeRow(outcome) {
  return el("div", { class: "kx-row", style: "--kx:" + (outcome.color || "#f4f7fb") }, [
    el("div", { class: "kx-name" }, [
      el("i", { class: "kx-dot", style: "background:" + (outcome.color || "#f4f7fb") }),
      el("span", { text: outcome.name || "YES" })
    ]),
    el("div", { class: "kx-fig" }, [
      el("span", { class: "kx-p", style: "color:" + (outcome.color || "#f4f7fb"), text: pctText(outcome.pct) }),
      changeEl(outcome.change)
    ])
  ]);
}

function pctText(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return "—";
  return Math.round(pct) + "%";
}

function changeEl(change) {
  if (change == null || !Number.isFinite(Number(change))) return el("span", { class: "kx-chg", text: "" });
  const rounded = Math.round(change);
  if (rounded > 0) return el("span", { class: "kx-chg up", text: "▲ " + rounded });
  if (rounded < 0) return el("span", { class: "kx-chg down", text: "▼ " + Math.abs(rounded) });
  return el("span", { class: "kx-chg flat", text: "–" });
}

function chartSvg(outcomes, range, timeZone) {
  const w = 1600;
  const h = 700;
  const padL = 18;
  const padR = 390;
  const padT = 36;
  const padB = 58;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const children = [];
  for (const yv of [0, 25, 50, 75, 100]) {
    const y = padT + (100 - yv) / 100 * plotH;
    children.push(svg("line", {
      x1: padL,
      y1: y.toFixed(1),
      x2: padL + plotW,
      y2: y.toFixed(1),
      stroke: yv === 0 ? "rgba(244,247,251,.32)" : "rgba(244,247,251,.2)",
      "stroke-width": "1.5",
      "stroke-dasharray": yv === 0 ? "0" : "1.5 8",
      "stroke-linecap": "round"
    }));
    children.push(svg("text", {
      x: w - 16,
      y: (y + 6).toFixed(1),
      fill: "rgba(244,247,251,.5)",
      "font-size": "22",
      "text-anchor": "end",
      "font-family": "Avenir Next, Helvetica, sans-serif",
      text: yv + "%"
    }));
  }
  const series = [];
  for (let i = 0; i < (outcomes || []).length; i++) {
    const outcome = outcomes[i];
    const pts = [];
    const raw = outcome.points || [];
    for (let p = 0; p < raw.length; p++) {
      const point = raw[p];
      if (point && Number.isFinite(point.t) && Number.isFinite(point.yes)) pts.push(point);
    }
    series.push({
      name: outcome.name || "YES",
      color: outcome.color || "#f0d78c",
      pct: outcome.pct,
      pts: pts
    });
  }
  let t0 = Infinity;
  let t1 = -Infinity;
  for (let i = 0; i < series.length; i++) {
    const pts = series[i].pts;
    for (let p = 0; p < pts.length; p++) {
      if (pts[p].t < t0) t0 = pts[p].t;
      if (pts[p].t > t1) t1 = pts[p].t;
    }
  }
  if (!(t1 > t0)) {
    t1 = Date.now();
    t0 = t1 - 24 * 60 * 60 * 1000;
  }
  const xOf = (t) => padL + (t - t0) / (t1 - t0) * plotW;
  const yOf = (yes) => padT + (100 - clamp(yes, 0, 100)) / 100 * plotH;
  const draw = series.slice().sort((a, b) => (a.pct == null ? 0 : a.pct) - (b.pct == null ? 0 : b.pct));
  for (let i = 0; i < draw.length; i++) {
    const line = draw[i];
    if (line.pts.length < 2) continue;
    let d = "";
    for (let p = 0; p < line.pts.length; p++) {
      d += (p ? "L" : "M") + xOf(line.pts[p].t).toFixed(1) + " " + yOf(line.pts[p].yes).toFixed(1);
    }
    children.push(svg("path", {
      d: d,
      fill: "none",
      stroke: line.color,
      "stroke-width": "4",
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    }));
  }
  const labels = [];
  for (let i = 0; i < series.length; i++) {
    const line = series[i];
    const last = line.pts.length ? line.pts[line.pts.length - 1] : null;
    const pct = line.pct != null ? line.pct : (last ? last.yes : null);
    if (pct == null) continue;
    const y = yOf(pct);
    const x = last ? xOf(last.t) : padL + plotW;
    if (last) {
      children.push(svg("circle", {
        cx: x.toFixed(1),
        cy: yOf(last.yes).toFixed(1),
        r: "6",
        fill: line.color
      }));
    }
    labels.push({ y: y, x: x, color: line.color, name: line.name, pct: pct });
  }
  labels.sort((a, b) => a.y - b.y);
  const ys = spreadYs(labels.map((lab) => lab.y), padT + 28, padT + plotH - 8, 78);
  for (let i = 0; i < labels.length; i++) {
    const lab = labels[i];
    const lx = padL + plotW + 18;
    if (Math.abs(ys[i] - lab.y) > 10) {
      children.push(svg("line", {
        x1: lab.x.toFixed(1),
        y1: lab.y.toFixed(1),
        x2: lx - 8,
        y2: ys[i].toFixed(1),
        stroke: lab.color,
        "stroke-width": "1.5",
        "stroke-opacity": "0.55"
      }));
    }
    children.push(svg("text", {
      x: lx,
      y: (ys[i] - 16).toFixed(1),
      fill: lab.color,
      "font-size": "24",
      "font-family": "Avenir Next, Helvetica, sans-serif",
      text: shortName(lab.name)
    }));
    children.push(svg("text", {
      x: lx,
      y: (ys[i] + 30).toFixed(1),
      fill: lab.color,
      "font-size": "52",
      "font-weight": "700",
      "font-family": "Avenir Next Condensed, Arial Narrow, Impact, sans-serif",
      text: Math.round(lab.pct) + "%"
    }));
  }
  const ticks = dateTicks(t0, t1, range, timeZone);
  for (let i = 0; i < ticks.length; i++) {
    children.push(svg("text", {
      x: xOf(ticks[i].t).toFixed(1),
      y: h - 16,
      fill: "rgba(244,247,251,.62)",
      "font-size": "22",
      "text-anchor": "middle",
      "font-family": "Avenir Next, Helvetica, sans-serif",
      text: ticks[i].label
    }));
  }
  return svg("svg", { viewBox: "0 0 " + w + " " + h, preserveAspectRatio: "xMidYMid meet" }, children);
}

function shortName(name) {
  const text = String(name || "");
  if (text.length <= 22) return text;
  return text.slice(0, 21) + "…";
}

function spreadYs(ys, minY, maxY, gap) {
  const out = ys.slice();
  if (!out.length) return out;
  out[0] = clamp(out[0], minY, maxY);
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap);
  if (out[out.length - 1] > maxY) {
    out[out.length - 1] = maxY;
    for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - gap);
  }
  if (out[0] < minY) {
    out[0] = minY;
    for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap);
  }
  return out;
}

function dateTicks(t0, t1, range, timeZone) {
  const count = range === "1D" ? 5 : 4;
  const span = t1 - t0;
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0.5 : i / (count - 1);
    const t = t0 + span * (0.06 + 0.88 * f);
    ticks.push({ t: t, label: formatTick(t, span, range, timeZone) });
  }
  return ticks;
}

function formatTick(ms, span, range, timeZone) {
  const tz = timeZone || "America/New_York";
  const d = new Date(ms);
  if (range === "1H" || span < 3 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  }
  if (range === "1D" || span < 36 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric" }).format(d);
  }
  const month = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short" }).format(d);
  if (range === "ALL" && span > 120 * 24 * 60 * 60 * 1000) {
    const year = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" }).format(d);
    return month + " " + year;
  }
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric" }).format(d);
  return month + " " + day;
}
