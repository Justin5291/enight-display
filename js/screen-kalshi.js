import { el, svg, clear, topbar, starsLabel, formatClock } from "./util.js";
import { getQuote } from "./kalshi.js";

export function mountKalshi(node, state) {
  paint(node, state);
  node._patch = (s) => {
    const q = getQuote(s.live.marketId) || {};
    const market = s.markets.find((m) => m.id === s.live.marketId);
    const sig = [s.live.marketId, q.updated || 0, q.pct == null ? "" : Math.round(q.pct * 10), q.points ? q.points.length : 0, s.brand.title, market ? market.label : ""].join("|");
    if (sig === node._sig && node.firstChild) return;
    node._sig = sig;
    paint(node, s);
  };
}

function paint(node, state) {
  const market = state.markets.find((m) => m.id === state.live.marketId) || null;
  const quote = market ? getQuote(market.id) : null;
  clear(node);
  node.appendChild(topbar(state.brand, "KALSHI"));
  if (!market) {
    node.appendChild(el("div", { class: "kx-empty" }, [
      starsLabel("KALSHI"),
      el("h1", { class: "h-display silver", text: "MARKETS" })
    ]));
    return;
  }
  const pct = quote && quote.pct != null ? quote.pct : null;
  const title = (quote && quote.title) || market.label || market.ticker;
  const side = el("div", { class: "kx-side" }, [
    el("div", { class: "kx-yes", text: "YES" }),
    el("div", { class: "kx-pct silver", text: pct == null ? "—" : Math.round(pct) + "%" }),
    el("h2", { class: "kx-title", text: title }),
    el("div", { class: "kx-sub", text: market.ticker + (quote && quote.updated ? "   ·   " + formatClock(quote.updated, state.settings.timezone) + " ET" : "") })
  ]);
  const chart = el("div", { class: "kx-chart" }, [chartSvg(quote && quote.points)]);
  node.appendChild(el("div", { class: "kx" }, [side, chart]));
}

function chartSvg(points) {
  const w = 640;
  const h = 360;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const children = [];
  for (const yv of [25, 50, 75]) {
    const y = padT + (100 - yv) / 100 * (h - padT - padB);
    children.push(svg("line", { x1: padL, y1: y.toFixed(1), x2: w - padR, y2: y.toFixed(1), stroke: "rgba(255,255,255,.16)", "stroke-width": "1" }));
    children.push(svg("text", { x: 4, y: (y + 4).toFixed(1), fill: "rgba(255,255,255,.55)", "font-size": "12", text: String(yv) }));
  }
  const pts = (points || []).filter((p) => p && Number.isFinite(p.yes));
  if (pts.length >= 2) {
    let min = Math.min(...pts.map((p) => p.yes));
    let max = Math.max(...pts.map((p) => p.yes));
    if (max - min < 4) { min = Math.max(0, min - 2); max = Math.min(100, max + 2); }
    min = Math.max(0, min - 1);
    max = Math.min(100, max + 1);
    const sx = (w - padL - padR) / (pts.length - 1);
    const sy = (h - padT - padB) / (max - min || 1);
    const coords = pts.map((p, i) => [padL + i * sx, padT + (max - p.yes) * sy]);
    const line = coords.map((c, i) => (i ? "L" : "M") + c[0].toFixed(1) + " " + c[1].toFixed(1)).join(" ");
    const fill = line + " L" + coords[coords.length - 1][0].toFixed(1) + " " + (h - padB) + " L" + coords[0][0].toFixed(1) + " " + (h - padB) + " Z";
    children.push(svg("path", { d: fill, fill: "rgba(179,22,28,.35)" }));
    children.push(svg("path", { d: line, fill: "none", stroke: "#ffffff", "stroke-width": "3", "stroke-linejoin": "round", "stroke-linecap": "round" }));
  }
  return svg("svg", { viewBox: "0 0 " + w + " " + h, preserveAspectRatio: "none" }, children);
}
