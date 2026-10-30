import { mountSenate, mountHouse, mountMap, mountCountdown } from "./screen-control.js";
import { mountSenateFeed, mountHouseFeed } from "./screen-seats.js";
import { mountHolding, mountSegment } from "./screen-show.js";
import { mountKalshi } from "./screen-kalshi.js";
import { mountSites, mountSite } from "./screen-sites.js";
import { mountMedia, mountMediaShow } from "./screen-media.js";
import { mountHome } from "./screen-home.js";
import { mountSenateMap, mountGovMap, mountHouseMap } from "./screen-maps.js";
import { closePdf } from "./pdf-view.js";

const mounts = {
  home: mountHome,
  holding: mountHolding,
  segment: mountSegment,
  senate: mountSenateFeed,
  house: mountHouseFeed,
  senateManual: mountSenate,
  houseManual: mountHouse,
  map: mountMap,
  countdown: mountCountdown,
  kalshi: mountKalshi,
  sites: mountSites,
  site: mountSite,
  media: mountMedia,
  mediashow: mountMediaShow,
  senatemap: mountSenateMap,
  govmap: mountGovMap,
  housemap: mountHouseMap
};

export function mount(root, state) {
  closePdf();
  root.replaceChildren();
  const node = document.createElement("section");
  node.className = "screen screen-" + state.screen;
  node.dataset.screen = state.screen;
  root.appendChild(node);
  const fn = mounts[state.screen] || mounts.holding;
  fn(node, state);
  root._node = node;
}

export function patch(root, state) {
  const node = root._node;
  if (!node || node.dataset.screen !== state.screen) {
    mount(root, state);
    return;
  }
  if (node._patch) node._patch(state);
}

export function tick(root, state) {
  const node = root._node;
  if (node && node._tick) node._tick(state);
}
