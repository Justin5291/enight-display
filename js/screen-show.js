import { el, clear, topbar, starsLabel } from "./util.js";

const ART = "brand-reference/election-night-key-art.png";

export function mountHolding(node, state) {
  paintHold(node, state);
  node._patch = (s) => {
    const title = node.querySelector("[data-brand]");
    if (title) title.textContent = s.brand.title;
    const show = node.querySelector("[data-show]");
    if (show) show.textContent = s.brand.show;
  };
}

function paintHold(node, state) {
  clear(node);
  const blur = el("img", { class: "hold-blur", alt: "", src: ART, draggable: "false" });
  const fg = el("img", { class: "hold-fg", alt: "Election Night", src: ART, draggable: "false" });
  const fallback = el("div", { class: "hold-fallback" }, [
    starsLabel("LIVE"),
    el("h1", { class: "h-display silver", "data-brand": "1", text: state.brand.title }),
    el("p", { class: "subhead", "data-show": "1", text: state.brand.show })
  ]);
  fallback.hidden = true;
  const fail = () => {
    fallback.hidden = false;
    if (fg.parentNode) fg.remove();
    if (blur.parentNode) blur.remove();
  };
  fg.addEventListener("error", fail);
  node.appendChild(el("div", { class: "hold" }, [blur, el("div", { class: "hold-shade" }), fg, fallback]));
}

export function mountSegment(node, state) {
  paintSegment(node, state);
  node._patch = (s) => paintSegment(node, s);
}

function paintSegment(node, state) {
  const seg = state.segments.find((g) => g.id === state.live.segmentId) || state.segments[0];
  clear(node);
  if (!seg) {
    node.appendChild(topbar(state.brand, "SHOW"));
    return;
  }
  node.appendChild(topbar(state.brand, seg.time || "SHOW"));
  const card = el("div", { class: "showcard" });
  card.appendChild(el("div", { class: "subhead", text: state.brand.show }));
  if (seg.sponsor) {
    card.appendChild(starsLabel("BROUGHT TO YOU BY"));
    card.appendChild(hero(seg.sponsorName || seg.title || "Sponsor"));
    if (seg.sponsorLine) card.appendChild(el("div", { class: "subhead", text: seg.sponsorLine }));
  } else if ((seg.guests || []).length <= 1) {
    card.appendChild(starsLabel(seg.code || "SEGMENT"));
    card.appendChild(hero(seg.guests[0] || seg.title || ""));
    const line = [seg.detail, seg.guests[0] ? "" : ""].filter(Boolean);
    if (seg.detail) card.appendChild(el("div", { class: "subhead", text: seg.detail }));
    else if (!seg.guests[0] && seg.title) { /* title already used as hero */ }
    else if (seg.guests[0] && seg.title && seg.title !== seg.guests[0]) {
      /* detail already shown; title is redundant when it matches the guest */
    }
    void line;
  } else {
    card.appendChild(starsLabel(seg.code || "SEGMENT"));
    card.appendChild(hero(seg.title || seg.code || ""));
    const list = el("ul", { class: "guest-list" });
    for (const name of seg.guests) list.appendChild(el("li", { text: name }));
    card.appendChild(list);
    if (seg.detail) card.appendChild(el("div", { class: "subhead", text: seg.detail }));
  }
  card.appendChild(el("div", { class: "show-time", text: seg.time || "" }));
  node.appendChild(card);
}

function hero(text) {
  const h = el("h1", { class: "h-display show-hero silver", text: text });
  if (text.length > 18) h.style.fontSize = "3.6em";
  if (text.length > 32) h.style.fontSize = "2.5em";
  return h;
}
