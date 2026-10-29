import { loadState, getState, update, subscribe, visualKey } from "./state.js";
import { mount, patch, tick } from "./screens.js";
import { initMarkup, clearInk, setMarkupEnabled } from "./markup.js";
import { initDock, trackPage } from "./dock.js";
import { initSettings, openSettings } from "./settings.js";
import { startKalshi } from "./kalshi.js";
import { startSeats, onSeats } from "./nyt.js";

const root = document.getElementById("screen");
let seen = null;

loadState();

initMarkup({
  canvas: document.getElementById("ink"),
  toggleBtn: document.getElementById("dock-draw"),
  undoBtn: document.getElementById("dock-undo"),
  clearBtn: document.getElementById("dock-clear"),
  getMarkup: () => getState().settings.markup
});

initDock({
  onHome: () => update((s) => { s.screen = "home"; }),
  onGear: (section) => openSettings(section)
});

initSettings();

function render() {
  const s = getState();
  const key = visualKey(s);
  setMarkupEnabled(s.screen !== "home");
  if (seen !== null && key !== seen && s.settings.markup.autoClear) clearInk();
  const changed = key !== seen;
  seen = key;
  if (changed || !root._node) mount(root, s);
  else patch(root, s);
  trackPage(s);
}

subscribe(render);
render();

startKalshi(getState, () => {
  const s = getState();
  if (s.screen === "kalshi" || s.screen === "home") patch(root, s);
}, (info) => {
  update((s) => {
    const market = s.markets.find((row) => row.id === info.id);
    if (!market) return;
    if (info.ticker) market.ticker = info.ticker;
    if (info.series) market.series = info.series;
    if (info.label) market.label = info.label;
  });
});

startSeats(() => getState().settings.feedDate);
onSeats(() => {
  const s = getState();
  if (s.screen === "senate" || s.screen === "house" || s.screen === "home") patch(root, s);
});

setInterval(() => {
  if (getState().screen === "countdown") tick(root, getState());
}, 1000);

window.addEventListener("resize", () => {
  const node = root._node;
  if (node && node._relayout) node._relayout();
});

window.addEventListener("error", (ev) => {
  window.__enightLastError = ev.message || "Script error";
});
window.addEventListener("unhandledrejection", (ev) => {
  const reason = ev.reason;
  window.__enightLastError = (reason && reason.message) || String(reason || "Unhandled error");
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

window.__ENIGHT = { getState, update };
