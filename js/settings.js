import { getState, update, setCall, exportPayload, importPayload, resetShow } from "./state.js";
import { CATEGORIES } from "./data.js";
import { el, clear, uid, todayInZone, formatClose } from "./util.js";
import { pokeKalshi } from "./kalshi.js";
import { pokeSeats } from "./nyt.js";
import { clearInk } from "./markup.js";
import { deleteBlob } from "./media-db.js";

const NAV = [
  ["show", "Show"],
  ["categories", "Categories"],
  ["markup", "Markup"],
  ["kalshi", "Kalshi"],
  ["senate", "Senate"],
  ["house", "House"],
  ["races", "Races"],
  ["states", "States"],
  ["segments", "Run of show"],
  ["sites", "Websites"],
  ["media", "Media"],
  ["backup", "Backup"]
];

const MARKUP_COLORS = ["#ffe14a", "#ff3b30", "#2f7dff", "#ffffff", "#111111", "#3dff8a"];
const MARKUP_TOOLS = [
  ["pen", "Pen"],
  ["highlighter", "Highlighter"],
  ["line", "Line"],
  ["arrow", "Arrow"],
  ["rect", "Box"],
  ["ellipse", "Circle"]
];

let sheet = null;
let section = "show";
let onClose = () => {};
let stateQuery = "";
let featuredOnly = false;
let openRace = null;
const armed = {};

export function initSettings(opts) {
  sheet = document.getElementById("sheet");
  onClose = (opts && opts.onClose) || onClose;
}

export function settingsOpen() {
  return sheet && !sheet.hidden;
}

export function openSettings(which) {
  if (which && NAV.some((row) => row[0] === which)) section = which;
  sheet.hidden = false;
  document.body.classList.add("sheet-open");
  render();
}

export function closeSettings() {
  sheet.hidden = true;
  document.body.classList.remove("sheet-open");
  onClose();
}

function render() {
  const restore = document.activeElement && document.activeElement.id;
  const caret = restore && document.activeElement.selectionStart;
  clear(sheet);
  const nav = el("div", { class: "sheet-nav" });
  for (const [id, label] of NAV) {
    const btn = el("button", { type: "button", class: id === section ? "on" : "", text: label });
    btn.addEventListener("click", () => {
      section = id;
      render();
    });
    nav.appendChild(btn);
  }
  const pane = el("div", { class: "sheet-pane" });
  (RENDER[section] || RENDER.show)(pane);
  const close = el("button", { type: "button", class: "bigbtn", text: "Close" });
  close.addEventListener("click", closeSettings);
  sheet.appendChild(el("div", { class: "sheet-head" }, [el("h2", { text: "SETUP" }), close]));
  sheet.appendChild(el("div", { class: "sheet-body" }, [nav, pane]));
  if (restore) {
    const again = document.getElementById(restore);
    if (again) {
      again.focus();
      if (caret != null && again.setSelectionRange) again.setSelectionRange(caret, caret);
    }
  }
}

const RENDER = {
  show: renderShow,
  categories: renderCategories,
  markup: renderMarkup,
  kalshi: renderKalshi,
  senate: (pane) => renderBoard(pane, "senate"),
  house: (pane) => renderBoard(pane, "house"),
  races: renderRaces,
  states: renderStates,
  segments: renderSegments,
  sites: renderSites,
  media: renderMedia,
  backup: renderBackup
};

function renderShow(pane) {
  const s = getState();
  pane.appendChild(el("h3", { text: "Branding" }));
  pane.appendChild(el("p", { class: "hint", text: "Titles edit here. Colors and the silver type live in the :root block at the top of css/app.css." }));
  pane.appendChild(field("On-air title", textInput(s.brand.title, (v) => update((st) => { st.brand.title = v || "ELECTION NIGHT"; }))));
  pane.appendChild(field("Show name", textInput(s.brand.show, (v) => update((st) => { st.brand.show = v; }))));
  pane.appendChild(el("h3", { text: "Clock" }));
  pane.appendChild(field("Election date", dateInput(s.settings.electionDate, (v) => update((st) => { st.settings.electionDate = v; }))));
  pane.appendChild(field("Results feed date", dateInput(s.settings.feedDate, (v) => {
    update((st) => { st.settings.feedDate = v; });
    pokeSeats();
  })));
  pane.appendChild(el("p", { class: "hint", text: "Senate and House seat trackers read AP calls from the NYT results files for the feed date. Default is 2026-11-03. Set 2024-11-05 to rehearse with the last cycle. The election date above is only the poll-close clock." }));
  pane.appendChild(el("button", { type: "button", class: "bigbtn", text: "Use today", onClick: () => {
    update((st) => { st.settings.electionDate = todayInZone(st.settings.timezone); });
    render();
  } }));
  pane.appendChild(check("Auto-mark polls closed when the close time passes", s.settings.autoClosePolls, (v) => update((st) => { st.settings.autoClosePolls = v; })));
}

function renderMarkup(pane) {
  const mk = getState().settings.markup;
  pane.appendChild(el("h3", { text: "Markup" }));
  pane.appendChild(el("p", { class: "hint", text: "Set color and stroke here before air. On the strip, Draw and Undo are the live controls. Clear is the button below." }));
  const colors = el("div", { class: "inline" });
  for (const color of MARKUP_COLORS) {
    const btn = el("button", { type: "button", class: "swatch" + (mk.color.toLowerCase() === color ? " on" : ""), style: "background:" + color });
    btn.addEventListener("click", () => {
      update((st) => { st.settings.markup.color = color; });
      render();
    });
    colors.appendChild(btn);
  }
  const picker = el("input", { type: "color", value: mk.color });
  picker.addEventListener("change", () => update((st) => { st.settings.markup.color = picker.value; }));
  colors.appendChild(picker);
  pane.appendChild(field("Color", colors));
  const size = el("input", { type: "range", min: "4", max: "48", step: "1", value: String(mk.size) });
  const sizeLabel = el("span", { text: String(mk.size) });
  size.addEventListener("input", () => {
    sizeLabel.textContent = size.value;
    update((st) => { st.settings.markup.size = Number(size.value); });
  });
  pane.appendChild(field("Stroke", el("div", { class: "inline" }, [size, sizeLabel])));
  const tools = el("div", { class: "inline" });
  for (const [id, label] of MARKUP_TOOLS) {
    const btn = el("button", { type: "button", class: "mini" + (mk.tool === id ? " on" : ""), text: label });
    btn.addEventListener("click", () => {
      update((st) => { st.settings.markup.tool = id; });
      render();
    });
    tools.appendChild(btn);
  }
  pane.appendChild(field("Tool", tools));
  pane.appendChild(check("Clear drawings when the on-air picture changes", mk.autoClear, (v) => update((st) => { st.settings.markup.autoClear = v; })));
  pane.appendChild(el("button", { type: "button", class: "bigbtn", text: "Clear drawings", onClick: () => clearInk() }));
}

function renderCategories(pane) {
  const s = getState();
  pane.appendChild(el("h3", { text: "Categories" }));
  pane.appendChild(el("p", { class: "hint", text: "Each switch is one section on the home dashboard. Off hides that section. Map, race calls, poll closes, and the manual seat boards start off. Their screens are still here." }));
  for (const cat of CATEGORIES) {
    const on = !!(s.settings.categories && s.settings.categories[cat.id]);
    pane.appendChild(check(cat.label, on, (v) => update((st) => { st.settings.categories[cat.id] = v; })));
  }
}

function renderKalshi(pane) {
  const s = getState();
  pane.appendChild(el("h3", { text: "Kalshi proxy" }));
  pane.appendChild(el("p", { class: "hint", text: "Browser calls to api.elections.kalshi.com get HTTP 403 and no CORS headers, so the chart loads through a proxy. The show proxy is filled in when this is empty. Replace it only if you deploy your own worker." }));
  const input = textInput(s.settings.kalshiProxy, (v) => {
    update((st) => { st.settings.kalshiProxy = v.trim(); });
    pokeKalshi();
  });
  input.placeholder = "https://your-worker.workers.dev";
  pane.appendChild(field("Proxy base URL", input));
  pane.appendChild(field("Refresh seconds", numInput(s.settings.kalshiRefreshSec, (n) => update((st) => { st.settings.kalshiRefreshSec = n; }))));
  pane.appendChild(el("h3", { text: "Saved markets" }));
  pane.appendChild(el("p", { class: "hint", text: "Add a market from the home dashboard, or edit saved ones here. Chart range is saved on each market. The Kalshi screen has the same ranges." }));
  if (!s.markets.length) pane.appendChild(el("p", { class: "hint", text: "None saved yet." }));
  s.markets.forEach((market, index) => {
    const box = el("div", { class: "editor" });
    box.appendChild(field("Label", textInput(market.label, (v) => update((st) => {
      const row = st.markets.find((m) => m.id === market.id);
      if (row) row.label = v;
    }))));
    box.appendChild(field("Ticker", textInput(market.ticker, (v) => {
      update((st) => {
        const row = st.markets.find((m) => m.id === market.id);
        if (row) row.ticker = v.trim().toUpperCase();
      });
      pokeKalshi();
    })));
    box.appendChild(field("Chart range", selectInput(market.range || "ALL", [
      ["1H", "1H"],
      ["1D", "1D"],
      ["1W", "1W"],
      ["1M", "1M"],
      ["ALL", "ALL"]
    ], (v) => {
      update((st) => {
        const row = st.markets.find((m) => m.id === market.id);
        if (row) row.range = v;
      });
      pokeKalshi();
    })));
    box.appendChild(el("div", { class: "inline" }, [
      el("button", { type: "button", class: "mini", text: "Up", onClick: () => move("markets", index, -1) }),
      el("button", { type: "button", class: "mini", text: "Down", onClick: () => move("markets", index, 1) }),
      el("button", { type: "button", class: "mini danger", text: "Delete", onClick: () => {
        update((st) => { st.markets = st.markets.filter((m) => m.id !== market.id); });
        render();
      } })
    ]));
    pane.appendChild(box);
  });
}

function renderBoard(pane, chamber) {
  const b = getState()[chamber];
  const name = chamber === "senate" ? "Senate" : "House";
  pane.appendChild(el("h3", { text: name }));
  pane.appendChild(el("p", { class: "hint", text: "Manual board only. The home dashboard seat trackers use AP calls from the NYT feed and ignore these numbers. Turn on Manual boards under Categories to put this board on air." }));
  pane.appendChild(el("div", { class: "grid-2" }, [
    field("Republican", numInput(b.r, (n) => update((st) => { st[chamber].r = n; }))),
    field("Democrat", numInput(b.d, (n) => update((st) => { st[chamber].d = n; }))),
    field("Independent", numInput(b.i, (n) => update((st) => { st[chamber].i = n; }))),
    field("Vacant", numInput(b.vacant || 0, (n) => update((st) => { st[chamber].vacant = n; }))),
    field("Total seats", numInput(b.total, (n) => update((st) => { st[chamber].total = n; }))),
    field("Majority", numInput(b.majority, (n) => update((st) => { st[chamber].majority = n; })))
  ]));
  pane.appendChild(field("Subtitle", textInput(b.subtitle, (v) => update((st) => { st[chamber].subtitle = v || "CURRENT"; }))));
}

function renderRaces(pane) {
  const s = getState();
  pane.appendChild(el("h3", { text: "Races" }));
  pane.appendChild(check("Apply Senate and House calls to the control totals", s.settings.applyCallsToControl, (v) => update((st) => { st.settings.applyCallsToControl = v; })));
  pane.appendChild(el("p", { class: "hint", text: "Off by default. This only changes the manual Senate and House boards, not the AP/NYT seat trackers." }));
  pane.appendChild(el("button", { type: "button", class: "bigbtn", text: "Add race", onClick: () => {
    const id = uid("race");
    update((st) => {
      st.races.push({
        id: id,
        title: "New race",
        short: "NEW",
        state: "",
        control: null,
        reporting: 0,
        calledId: null,
        controlApplied: null,
        candidates: [
          { id: id + "-a", name: "Republican", party: "R", votes: 0 },
          { id: id + "-b", name: "Democrat", party: "D", votes: 0 }
        ]
      });
      st.live.raceId = id;
    });
    openRace = id;
    render();
  } }));
  for (const race of s.races) {
    const box = el("div", { class: "editor" });
    const head = el("div", { class: "inline" }, [
      el("h4", { text: race.title }),
      el("button", { type: "button", class: "mini", text: openRace === race.id ? "Close" : "Edit", onClick: () => {
        openRace = openRace === race.id ? null : race.id;
        render();
      } })
    ]);
    box.appendChild(head);
    if (openRace === race.id) fillRace(box, race);
    pane.appendChild(box);
  }
}

function fillRace(box, race) {
  box.appendChild(el("div", { class: "grid-2" }, [
    field("Title", textInput(race.title, (v) => update((st) => { const row = findRace(st, race.id); if (row) row.title = v; }))),
    field("Short", textInput(race.short, (v) => update((st) => { const row = findRace(st, race.id); if (row) row.short = v; }))),
    field("State abbr", textInput(race.state || "", (v) => update((st) => { const row = findRace(st, race.id); if (row) row.state = v.toUpperCase(); }))),
    field("% reporting", numInput(race.reporting, (n) => update((st) => { const row = findRace(st, race.id); if (row) row.reporting = n; })))
  ]));
  box.appendChild(field("Counts toward", selectInput(race.control || "", [["", "Neither"], ["senate", "Senate"], ["house", "House"]], (v) => update((st) => {
    const row = findRace(st, race.id);
    if (row) row.control = v || null;
  }))));
  for (const cand of race.candidates) {
    const row = el("div", { class: "grid-2" });
    row.appendChild(field("Name", textInput(cand.name, (v) => update((st) => {
      const person = findCand(st, race.id, cand.id);
      if (person) person.name = v;
    }))));
    row.appendChild(field("Party", selectInput(cand.party, [["R", "R"], ["D", "D"], ["I", "I"], ["O", "Other"]], (v) => update((st) => {
      const person = findCand(st, race.id, cand.id);
      if (person) person.party = v;
    }))));
    row.appendChild(field("Votes", numInput(cand.votes, (n) => update((st) => {
      const person = findCand(st, race.id, cand.id);
      if (person) person.votes = n;
    }))));
    const called = race.calledId === cand.id;
    row.appendChild(el("div", { class: "inline" }, [
      el("button", { type: "button", class: "mini " + (called ? "on" : ""), text: called ? "Called" : "Call", onClick: () => setCall(race.id, cand.id, { keepScreen: true }) }),
      el("button", { type: "button", class: "mini danger", text: "Remove", onClick: () => {
        update((st) => {
          const target = findRace(st, race.id);
          if (!target) return;
          target.candidates = target.candidates.filter((c) => c.id !== cand.id);
          if (target.calledId === cand.id) target.calledId = null;
        });
        render();
      } })
    ]));
    box.appendChild(row);
  }
  box.appendChild(el("div", { class: "inline" }, [
    el("button", { type: "button", class: "mini", text: "Add candidate", onClick: () => {
      update((st) => {
        const target = findRace(st, race.id);
        if (target) target.candidates.push({ id: uid("c"), name: "Candidate", party: "O", votes: 0 });
      });
      render();
    } }),
    el("button", { type: "button", class: "mini", text: "Uncall", onClick: () => { setCall(race.id, null); render(); } }),
    el("button", { type: "button", class: "mini", text: "Take call card", onClick: () => {
      update((st) => { st.live.raceId = race.id; st.screen = "call"; });
      closeSettings();
    } }),
    el("button", { type: "button", class: "mini danger", text: "Delete race", onClick: () => {
      update((st) => { st.races = st.races.filter((r) => r.id !== race.id); });
      openRace = null;
      render();
    } })
  ]));
}

function renderStates(pane) {
  pane.appendChild(el("h3", { text: "States" }));
  pane.appendChild(el("p", { class: "hint", text: "Checked times are the ones named in the rundown (OH, NC, ME, MI, TX, KS, FL). The rest are best-knowledge and marked unverified. Fix any of them here before air." }));
  const search = el("input", { id: "state-filter", type: "text", value: stateQuery, placeholder: "Filter by name or abbr" });
  search.addEventListener("input", () => {
    stateQuery = search.value;
    render();
  });
  pane.appendChild(field("Find", search));
  pane.appendChild(check("Featured only", featuredOnly, (v) => {
    featuredOnly = v;
    render();
  }));
  const q = stateQuery.trim().toLowerCase();
  for (const st of getState().states) {
    if (featuredOnly && !st.featured) continue;
    if (q && !st.abbr.toLowerCase().includes(q) && !st.name.toLowerCase().includes(q)) continue;
    pane.appendChild(stateEditor(st));
  }
}

function stateEditor(st) {
  const box = el("div", { class: "editor" });
  box.appendChild(el("h4", { text: st.abbr + "  " + st.name + "  ·  " + formatClose(st.closeMin) }));
  const time = el("input", { type: "time", value: minutesToTime(st.closeMin) });
  time.addEventListener("change", () => update((s) => {
    const row = s.states.find((item) => item.abbr === st.abbr);
    if (!row || !time.value) return;
    const nextDay = row.closeMin >= 1440;
    const bits = time.value.split(":").map(Number);
    row.closeMin = (nextDay ? 1440 : 0) + bits[0] * 60 + bits[1];
  }));
  box.appendChild(el("div", { class: "inline" }, [
    field("Close", time),
    check("After midnight", st.closeMin >= 1440, (v) => update((s) => {
      const row = s.states.find((item) => item.abbr === st.abbr);
      if (!row) return;
      const mins = ((row.closeMin % 1440) + 1440) % 1440;
      row.closeMin = mins + (v ? 1440 : 0);
    })),
    check("Verified", st.verified, (v) => update((s) => {
      const row = s.states.find((item) => item.abbr === st.abbr);
      if (row) row.verified = v;
    })),
    check("Featured", st.featured, (v) => update((s) => {
      const row = s.states.find((item) => item.abbr === st.abbr);
      if (row) row.featured = v;
    }))
  ]));
  box.appendChild(field("Status", selectInput(st.status, [
    ["auto", "Auto from clock"],
    ["open", "Not closed"],
    ["closed", "Closed"],
    ["early", "Too early"],
    ["R", "Called R"],
    ["D", "Called D"]
  ], (v) => update((s) => {
    const row = s.states.find((item) => item.abbr === st.abbr);
    if (row) row.status = v;
  }))));
  box.appendChild(field("Note", textInput(st.note, (v) => update((s) => {
    const row = s.states.find((item) => item.abbr === st.abbr);
    if (row) row.note = v;
  }))));
  return box;
}

function renderSegments(pane) {
  pane.appendChild(el("h3", { text: "Run of show" }));
  const segments = getState().segments;
  segments.forEach((seg, index) => {
    const box = el("div", { class: "editor" });
    box.appendChild(el("div", { class: "grid-2" }, [
      field("Time label", textInput(seg.time, (v) => update((s) => { const row = findSeg(s, seg.id); if (row) row.time = v; }))),
      field("Code", textInput(seg.code, (v) => update((s) => { const row = findSeg(s, seg.id); if (row) row.code = v; }))),
      field("Title", textInput(seg.title, (v) => update((s) => { const row = findSeg(s, seg.id); if (row) row.title = v; }))),
      field("Detail", textInput(seg.detail || "", (v) => update((s) => { const row = findSeg(s, seg.id); if (row) row.detail = v; })))
    ]));
    const guests = el("textarea", { rows: "3" });
    guests.value = (seg.guests || []).join("\n");
    guests.addEventListener("change", () => update((s) => {
      const row = findSeg(s, seg.id);
      if (row) row.guests = guests.value.split("\n").map((line) => line.trim()).filter(Boolean);
    }));
    box.appendChild(field("Guests, one per line", guests));
    box.appendChild(check("Sponsor card", seg.sponsor, (v) => update((s) => { const row = findSeg(s, seg.id); if (row) row.sponsor = v; })));
    box.appendChild(el("div", { class: "grid-2" }, [
      field("Sponsor name", textInput(seg.sponsorName || "", (v) => update((s) => { const row = findSeg(s, seg.id); if (row) row.sponsorName = v; }))),
      field("Sponsor line", textInput(seg.sponsorLine || "", (v) => update((s) => { const row = findSeg(s, seg.id); if (row) row.sponsorLine = v; })))
    ]));
    box.appendChild(el("div", { class: "inline" }, [
      el("button", { type: "button", class: "mini", text: "Up", onClick: () => move("segments", index, -1) }),
      el("button", { type: "button", class: "mini", text: "Down", onClick: () => move("segments", index, 1) }),
      el("button", { type: "button", class: "mini", text: "Take", onClick: () => {
        update((s) => { s.live.segmentId = seg.id; s.screen = "segment"; });
        closeSettings();
      } }),
      el("button", { type: "button", class: "mini danger", text: "Delete", onClick: () => {
        update((s) => { s.segments = s.segments.filter((g) => g.id !== seg.id); });
        render();
      } })
    ]));
    pane.appendChild(box);
  });
  pane.appendChild(el("button", { type: "button", class: "bigbtn", text: "Add segment", onClick: () => {
    update((s) => s.segments.push({
      id: uid("seg"),
      time: "",
      code: "NEW",
      title: "New segment",
      guests: [],
      detail: "",
      sponsor: false,
      sponsorName: "",
      sponsorLine: ""
    }));
    render();
  } }));
}

function renderSites(pane) {
  pane.appendChild(el("h3", { text: "Websites" }));
  pane.appendChild(el("p", { class: "hint", text: "Embed sites that allow iframes. Blocked sites should stay on Safari. Each site remembers zoom and pan." }));
  getState().sites.forEach((site, index) => {
    const known = site.embed === "yes" ? "Research: embeds" : site.embed === "no" ? "Research: blocked" : "Research: unknown";
    const box = el("div", { class: "editor" });
    box.appendChild(el("h4", { text: site.name + " · " + known }));
    box.appendChild(el("div", { class: "grid-2" }, [
      field("Name", textInput(site.name, (v) => update((s) => { const row = findSite(s, site.id); if (row) row.name = v; }))),
      field("Group", textInput(site.group, (v) => update((s) => { const row = findSite(s, site.id); if (row) row.group = v || "Other"; }))),
      field("URL", textInput(site.url, (v) => update((s) => { const row = findSite(s, site.id); if (row) row.url = v.trim(); }))),
      field("Open with", selectInput(site.mode, [["embed", "Embed"], ["safari", "Safari"]], (v) => update((s) => { const row = findSite(s, site.id); if (row) row.mode = v; })))
    ]));
    box.appendChild(el("div", { class: "grid-2" }, [
      field("Zoom", numInput(site.scale, (n) => update((s) => { const row = findSite(s, site.id); if (row) row.scale = n; }))),
      field("Pan X", numInput(site.x, (n) => update((s) => { const row = findSite(s, site.id); if (row) row.x = n; }))),
      field("Pan Y", numInput(site.y, (n) => update((s) => { const row = findSite(s, site.id); if (row) row.y = n; })))
    ]));
    box.appendChild(el("div", { class: "inline" }, [
      el("button", { type: "button", class: "mini", text: "Up", onClick: () => move("sites", index, -1) }),
      el("button", { type: "button", class: "mini", text: "Down", onClick: () => move("sites", index, 1) }),
      el("button", { type: "button", class: "mini", text: "Reset frame", onClick: () => {
        update((s) => {
          const row = findSite(s, site.id);
          if (!row) return;
          row.scale = 1;
          row.x = 0;
          row.y = 0;
        });
        render();
      } }),
      el("button", { type: "button", class: "mini danger", text: "Delete", onClick: () => {
        update((s) => { s.sites = s.sites.filter((row) => row.id !== site.id); });
        render();
      } })
    ]));
    pane.appendChild(box);
  });
  pane.appendChild(el("button", { type: "button", class: "bigbtn", text: "Add website", onClick: () => {
    update((s) => s.sites.push({
      id: uid("site"),
      name: "New site",
      url: "https://",
      mode: "safari",
      group: "Other",
      embed: "unknown",
      scale: 1,
      x: 0,
      y: 0
    }));
    render();
  } }));
}

function renderMedia(pane) {
  pane.appendChild(el("h3", { text: "Media library" }));
  pane.appendChild(el("p", { class: "hint", text: "Files stay on this iPad (IndexedDB). A JSON backup keeps the names, not the file bytes. URL items are saved in the backup. HEIC photos from the iPad camera roll sometimes will not draw — export a JPEG if a thumb stays blank." }));
  const items = getState().media;
  if (!items.length) pane.appendChild(el("p", { class: "hint", text: "Nothing loaded yet. Use Add files on the Media controls." }));
  items.forEach((item, index) => {
    const box = el("div", { class: "editor" });
    box.appendChild(field("Name", textInput(item.name, (v) => update((s) => {
      const row = s.media.find((m) => m.id === item.id);
      if (row) row.name = v;
    }))));
    box.appendChild(el("div", { class: "inline" }, [
      el("button", { type: "button", class: "mini", text: "Up", onClick: () => move("media", index, -1) }),
      el("button", { type: "button", class: "mini", text: "Down", onClick: () => move("media", index, 1) }),
      el("button", { type: "button", class: "mini", text: "Take", onClick: () => {
        update((s) => { s.live.mediaId = item.id; s.screen = "mediashow"; });
        closeSettings();
      } }),
      el("button", { type: "button", class: "mini danger", text: "Delete", onClick: () => removeMedia(item.id) })
    ]));
    pane.appendChild(box);
  });
  pane.appendChild(danger("Erase all media", "media", async () => {
    const ids = getState().media.map((m) => m.id);
    for (const id of ids) {
      try { await deleteBlob(id); } catch (e) { /* already gone */ }
    }
    update((s) => { s.media = []; s.live.mediaId = null; });
    render();
  }));
}

function renderBackup(pane) {
  pane.appendChild(el("h3", { text: "Backup" }));
  pane.appendChild(el("p", { class: "hint", text: "Export the show (races, sites, settings, run of show). File graphics are not inside the JSON." }));
  pane.appendChild(el("button", { type: "button", class: "bigbtn", text: "Export JSON", onClick: () => {
    const payload = JSON.stringify(exportPayload(), null, 2);
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    a.href = url;
    a.download = "election-night-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } }));
  const file = el("input", { type: "file", accept: "application/json,.json" });
  file.addEventListener("change", () => {
    const picked = file.files && file.files[0];
    if (!picked) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importPayload(JSON.parse(String(reader.result)));
        render();
      } catch (e) {
        window.__enightLastError = e.message || "Import failed";
        render();
      }
    };
    reader.readAsText(picked);
  });
  pane.appendChild(el("div", { class: "field" }, [el("span", { text: "Import JSON" }), file]));
  pane.appendChild(el("p", { class: "hint", text: window.__enightLastError ? "Last note: " + window.__enightLastError : "No errors recorded." }));
  pane.appendChild(danger("Reset show (keeps media files)", "reset", () => {
    resetShow();
    render();
  }));
  pane.appendChild(el("p", { class: "hint", text: "Reset restores the preset races, the Senate control market, an empty website list, the run of show, and the 53–47 / 218–214 starting numbers." }));
}

function removeMedia(id) {
  deleteBlob(id).catch(() => {});
  update((s) => {
    s.media = s.media.filter((m) => m.id !== id);
    if (s.live.mediaId === id) s.live.mediaId = null;
  });
  render();
}

function move(list, index, dir) {
  update((s) => {
    const arr = s[list];
    const j = index + dir;
    if (!arr || j < 0 || j >= arr.length) return;
    const [item] = arr.splice(index, 1);
    arr.splice(j, 0, item);
  });
  render();
}

function danger(label, key, fn) {
  const btn = el("button", { type: "button", class: "bigbtn danger", text: label });
  btn.addEventListener("click", () => {
    const now = Date.now();
    if (now - (armed[key] || 0) > 2500) {
      armed[key] = now;
      btn.textContent = "Tap again";
      return;
    }
    armed[key] = 0;
    fn();
  });
  return btn;
}

function field(label, control) {
  return el("label", { class: "field" }, [el("span", { text: label }), control]);
}

function textInput(value, onchange) {
  const input = el("input", { type: "text", value: value == null ? "" : String(value) });
  input.addEventListener("change", () => onchange(input.value));
  return input;
}

function numInput(value, onchange) {
  const input = el("input", { type: "number", value: String(value == null ? 0 : value) });
  input.addEventListener("change", () => onchange(Number(input.value)));
  return input;
}

function dateInput(value, onchange) {
  const input = el("input", { type: "date", value: value });
  input.addEventListener("change", () => onchange(input.value));
  return input;
}

function selectInput(value, options, onchange) {
  const sel = document.createElement("select");
  for (const [id, label] of options) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    if (String(id) === String(value == null ? "" : value)) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => onchange(sel.value));
  return sel;
}

function check(label, checked, onchange) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  input.addEventListener("change", () => onchange(input.checked));
  return el("label", { class: "check" }, [input, label]);
}

function minutesToTime(min) {
  const m = ((min % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return hh + ":" + mm;
}

function findRace(s, id) { return s.races.find((r) => r.id === id); }
function findCand(s, raceId, candId) {
  const race = findRace(s, raceId);
  return race && race.candidates.find((c) => c.id === candId);
}
function findSeg(s, id) { return s.segments.find((g) => g.id === id); }
function findSite(s, id) { return s.sites.find((site) => site.id === id); }
