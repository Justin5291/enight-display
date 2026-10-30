import { update } from "./state.js";

export function pageOf(state) {
  const screen = state.screen;
  if (screen === "home") return { key: "home", screen: "home", label: "Home" };
  if (screen === "holding") return { key: "holding", screen: screen, label: "Holding" };
  if (screen === "segment") {
    const seg = state.segments.find((g) => g.id === state.live.segmentId);
    return {
      key: "segment:" + (state.live.segmentId || ""),
      screen: screen,
      label: seg ? (seg.code || seg.title || "Show") : "Show",
      segmentId: state.live.segmentId
    };
  }
  if (screen === "senate") return { key: "senate", screen: screen, label: "Senate" };
  if (screen === "house") return { key: "house", screen: screen, label: "House" };
  if (screen === "senateManual") return { key: "senateManual", screen: screen, label: "Senate manual" };
  if (screen === "houseManual") return { key: "houseManual", screen: screen, label: "House manual" };
  if (screen === "senatemap") return { key: "senatemap", screen: screen, label: "Senate map" };
  if (screen === "govmap") return { key: "govmap", screen: screen, label: "Gov map" };
  if (screen === "housemap") return { key: "housemap", screen: screen, label: "House map" };
  if (screen === "map") return { key: "map", screen: screen, label: "Map" };
  if (screen === "countdown") return { key: "countdown", screen: screen, label: "Closes" };
  if (screen === "call" || screen === "tally") {
    const race = state.races.find((r) => r.id === state.live.raceId);
    const name = race ? (race.short || race.title || "Race") : "Race";
    return {
      key: screen + ":" + (state.live.raceId || ""),
      screen: screen,
      label: name + (screen === "tally" ? " tally" : " call"),
      raceId: state.live.raceId
    };
  }
  if (screen === "kalshi") {
    const market = state.markets.find((m) => m.id === state.live.marketId);
    return {
      key: "kalshi:" + (state.live.marketId || ""),
      screen: screen,
      label: market ? (market.label || market.ticker || "Kalshi") : "Kalshi",
      marketId: state.live.marketId
    };
  }
  if (screen === "site") {
    const site = state.sites.find((row) => row.id === state.live.siteId);
    return {
      key: "site:" + (state.live.siteId || ""),
      screen: screen,
      label: site ? site.name : "Site",
      siteId: state.live.siteId
    };
  }
  if (screen === "mediashow") {
    const item = state.media.find((m) => m.id === state.live.mediaId);
    return {
      key: "media:" + (state.live.mediaId || ""),
      screen: screen,
      label: item ? (item.name || "Graphic") : "Graphic",
      mediaId: state.live.mediaId
    };
  }
  return { key: screen || "home", screen: screen || "home", label: screen || "Home" };
}

export function labelFor(state, page) {
  if (!page) return "";
  if (page.screen === "segment" && page.segmentId) {
    const seg = state.segments.find((g) => g.id === page.segmentId);
    if (seg) return seg.code || seg.title || "Show";
  }
  if ((page.screen === "call" || page.screen === "tally") && page.raceId) {
    const race = state.races.find((r) => r.id === page.raceId);
    if (race) return (race.short || race.title || "Race") + (page.screen === "tally" ? " tally" : " call");
  }
  if (page.screen === "kalshi" && page.marketId) {
    const market = state.markets.find((m) => m.id === page.marketId);
    if (market) return market.label || market.ticker || "Kalshi";
  }
  if (page.screen === "site" && page.siteId) {
    const site = state.sites.find((row) => row.id === page.siteId);
    if (site) return site.name;
  }
  if (page.screen === "mediashow" && page.mediaId) {
    const item = state.media.find((m) => m.id === page.mediaId);
    if (item) return item.name || "Graphic";
  }
  return page.label || page.screen || "";
}

export function pageAlive(state, page) {
  if (!page || !page.screen || page.screen === "home") return false;
  if (page.screen === "kalshi") return !!state.markets.find((m) => m.id === page.marketId);
  if (page.screen === "site") return !!state.sites.find((row) => row.id === page.siteId);
  if (page.screen === "mediashow") return !!state.media.find((m) => m.id === page.mediaId);
  if (["call", "tally", "senateManual", "houseManual", "map"].includes(page.screen)) return false; /* manual boards are hidden */
  if (page.screen === "segment") return !!state.segments.find((g) => g.id === page.segmentId);
  return true;
}

export function goPage(page) {
  if (!page || !page.screen) return;
  update((s) => {
    if (page.segmentId) s.live.segmentId = page.segmentId;
    if (page.raceId) s.live.raceId = page.raceId;
    if (page.marketId) s.live.marketId = page.marketId;
    if (page.siteId) s.live.siteId = page.siteId;
    if (page.mediaId) s.live.mediaId = page.mediaId;
    s.screen = page.screen;
  });
}
