import { loadState, getState, update, subscribe, visualKey } from "./state.js";
import { mount, patch, tick } from "./screens.js";
import { initMarkup, markupOn, clearInk } from "./markup.js";
import { initOperator, setOperatorOpen, operatorOpen, refreshOperator } from "./operator.js";
import { initSettings, openSettings, settingsOpen } from "./settings.js";
import { startKalshi } from "./kalshi.js";

const root = document.getElementById("screen");
let seen = null;
let hideT = null;

loadState();

initMarkup({
  canvas: document.getElementById("ink"),
  bar: document.getElementById("inkbar"),
  toggleBtn: document.getElementById("ink-toggle"),
  undoBtn: document.getElementById("ink-undo"),
  clearBtn: document.getElementById("ink-clear"),
  getMarkup: () => getState().settings.markup
});

initOperator({
  onGear: (section) => {
    clearTimeout(hideT);
    openSettings(section);
  }
});

initSettings({
  onClose: () => {
    if (operatorOpen()) armHide();
    refreshOperator();
  }
});

function render() {
  const s = getState();
  const key = visualKey(s);
  if (seen !== null && key !== seen && s.settings.markup.autoClear) clearInk();
  const changed = key !== seen;
  seen = key;
  if (changed || !root._node) mount(root, s);
  else patch(root, s);
  refreshOperator();
}

subscribe(render);
render();

startKalshi(getState, () => {
  const s = getState();
  if (s.screen === "kalshi") patch(root, s);
  refreshOperator();
}, (info) => {
  update((s) => {
    const market = s.markets.find((row) => row.id === info.id);
    if (!market) return;
    if (info.ticker) market.ticker = info.ticker;
    if (info.series) market.series = info.series;
    if (info.label) market.label = info.label;
  });
});

document.getElementById("hot-reveal").addEventListener("click", () => {
  if (settingsOpen()) return;
  if (operatorOpen()) hideOp();
  else showOp();
});

document.getElementById("hot-sites").addEventListener("click", () => {
  if (settingsOpen()) return;
  update((s) => { s.screen = "sites"; });
});

const app = document.getElementById("app");
let press = null;
app.addEventListener("pointerdown", (e) => {
  if (markupOn() || settingsOpen()) return;
  if (e.target.closest("button, a, input, textarea, select, #op, #sheet, #inkbar")) return;
  const timer = setTimeout(() => {
    press = null;
    showOp();
  }, 600);
  press = { x: e.clientX, y: e.clientY, timer: timer };
});
app.addEventListener("pointermove", (e) => {
  if (!press) return;
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 14) {
    clearTimeout(press.timer);
    press = null;
  }
});
function endPress() {
  if (!press) return;
  clearTimeout(press.timer);
  press = null;
}
app.addEventListener("pointerup", endPress);
app.addEventListener("pointercancel", endPress);

const opEl = document.getElementById("op");
opEl.addEventListener("pointerdown", () => clearTimeout(hideT));
opEl.addEventListener("pointerup", () => armHide());
opEl.addEventListener("input", () => armHide());

function showOp() {
  setOperatorOpen(true);
  armHide();
}
function hideOp() {
  clearTimeout(hideT);
  setOperatorOpen(false);
}
function armHide() {
  clearTimeout(hideT);
  if (!operatorOpen() || settingsOpen()) return;
  hideT = setTimeout(hideOp, getState().settings.hideMs || 8000);
}

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
