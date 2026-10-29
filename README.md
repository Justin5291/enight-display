# Election Night Display

On-air graphics for the Bongino Studio 2026 midterms (Tuesday, November 3, 2026, live 8:00–10:00 PM ET). The iPad mini is the controller. AirPlay mirrors it to the 16:9 TV, so whatever is on the iPad is on air. Operator chrome stays hidden until you ask for it.

Plain static files. No build step. Numbers are typed in by hand. There is no licensed data feed.

## Run on the studio Wi-Fi

From this folder:

```bash
python3 -m http.server 8000
```

On the iPad, join the same network and open `http://<this-mac-ip>:8000/`.

Add to Home Screen (Share → Add to Home Screen) so it launches full screen. The manifest asks for landscape. Use the home-screen icon on show night, not a Safari tab.

The service worker caches the app shell only over `http` or `https`. Opening `index.html` as a file does not register it.

## Deploy

Any static host works. The app is the files in this folder. A home-screen PWA wants HTTPS.

Copy the folder to the host root, or to a subpath. If you use a subpath, keep the relative links (`css/`, `js/`, `./sw.js`) and serve `index.html` at that path. Scope in `manifest.webmanifest` is `./`.

Do not put a build in front of it. Edit the files and refresh.

## Keep the iPad awake

AirPlay shows the iPad, including lock screen, banners, and Low Power Mode dimming.

- Settings → Display & Brightness → Auto-Lock → Never.
- Plug in a charger. Turn Low Power Mode off.
- Turn on Focus or Do Not Disturb, and silence notifications. A banner on the iPad is a banner on the TV.
- Stay in the full-screen home-screen app. Do not switch to another app while you are live.
- Rehearsal: in Setup → Show, set Election date to today (or tap Use today) so poll-close countdowns and the map use tonight’s clock. Put it back to 2026-11-03 before the show.

## Controls

The picture is clean until you reveal the panel.

- Bottom-left corner: show or hide the operator bar. It auto-hides after 8 seconds (change that in Setup → Show).
- Bottom-right corner: jump to the sites dashboard from any source.
- Long-press (~0.6s) on empty picture: show the operator bar. A drag cancels the press.
- Gear: full-screen Setup. Hide it before you go back on air. The hotspots stay covered while Setup is open.
- Draw (only while markup is on): Draw, Undo, Clear. Color, size, pen vs highlighter, shapes, and auto-clear live in Setup → Markup, not on the live bar.

Markup draws on top of every in-app source. It does not follow a page opened in Safari.

Operator buttons are large on purpose: source row, race ‹ ›, one-tap Call, vote fields, segment Prev/Next, Kalshi add, site zoom, media add. Seat totals and the full race list are in Setup so the live bar stays short.

## Screens

| Screen | What it shows |
| --- | --- |
| Holding | Key-art branding card. Portrait art is blur-filled and letterboxed for 16:9. |
| Segment | Current run-of-show block: time, code, title, guests, sponsor on Close. |
| Senate | 53R–47D starting board, seats bar, majority 51. Dems need a net of 4. |
| House | 218R / 214D / 1I / 2 vacant, majority 218. |
| Map | Tile map of all states. Featured states are marked. Status is open, closed, too early, called R, or called D. |
| Call | PROJECTED WINNER card for the selected race. |
| Tally | Candidates, party, votes, percent, percent reporting. |
| Countdown | Next poll-close group, America/New_York, election date from Setup. |
| Kalshi | Big YES percent and a line chart. Empty until a market is added. |
| Sites | Dashboard of big tiles, grouped. One tap opens a site. |
| Site | Full-screen site. Embed fills the stage. Safari mode leaves the app. |
| Media | Library of files and URLs. |
| Media show | One graphic, video, or PDF full screen. |

## Kalshi

Research (already done, not re-tested here): `https://api.elections.kalshi.com/trade-api/v2` works from a server. A browser `Origin` gets HTTP 403 and no CORS headers, so the iPad cannot call Kalshi itself.

Set a proxy base URL in Setup → Kalshi. The app then requests:

- `GET {proxy}/trade-api/v2/markets/{ticker}`
- `GET {proxy}/trade-api/v2/events/{event_ticker}?with_nested_markets=true`
- `GET {proxy}/trade-api/v2/series/{series}/markets/{ticker}/candlesticks?start_ts&end_ts&period_interval=1` (falls back to 60-minute candles)

`proxy/kalshi-worker.js` is a Cloudflare Worker. It forwards `GET /trade-api/v2/*`, sends a browser User-Agent, and adds `Access-Control-Allow-Origin: *`.

Deploy it yourself (this repo does not deploy):

```bash
cd proxy
npx wrangler deploy
```

Or paste `proxy/kalshi-worker.js` into the Cloudflare dashboard as a module worker (`proxy/wrangler.toml` has the name and compatibility date). Put the worker origin, with no trailing path, in Setup → Kalshi.

Paste a ticker (`KXFOO-26-BAR`) or a `kalshi.com` market URL. With no proxy, the operator bar says Kalshi needs a proxy. That note never goes on air. The Kalshi site tile opens kalshi.com in Safari.

Prices: whole numbers 0–100 are cents, decimals at or under 1 are dollars (`1.0` is 100%, bare `1` is 1 cent).

## Which sites embed

Pre-seeded. Each tile has its own Embed / Safari switch in Setup → Sites. Framing (zoom and pan) is saved per site.

Embed (iframes allowed):

- decisiondeskhq.com
- results.elections.myflorida.com
- foxnews.com/elections
- youtube.com/embed/… (the seeded tile uses `VIDEO_ID` on purpose and shows a name card until you paste a real embed URL)

Safari (iframes blocked):

- x.com
- cnn.com
- polymarket.com
- 270towin.com
- apnews.com
- nytimes.com
- politico.com

Unknown, seeded as Safari:

- kalshi.com
- realclearpolling.com

Safari opens a new tab. Come back with the E-Night home-screen icon. Markup does not draw on that outside page. Pinch and drag framing works only while the operator bar is open, and only for embed tiles.

## State

Show data is in `localStorage` under `enight-display-v1`. Media file bytes are in IndexedDB (`enight-media` / `files`). Setup → Backup exports and imports JSON. The JSON does not include file bytes. Reset show restores the seed and keeps media records. Erase media is a separate second-tap control.

Calling a race does not move the Senate or House bars unless Setup → Show → Apply calls to control is on. It is off by default so a rehearsal call cannot change the board.

## Look

Colors and the display font stack are the `:root` block at the top of `css/app.css` (navy `#06123a`–`#0b2a7a`, red `#b3161c`, party red/blue, silver titles). Titles and the LOGO word also edit in Setup → Show. No network fonts. The stack is Avenir Next Condensed, Arial Narrow, Franklin Gothic, Impact.

## Known gaps

- Every number is manual. Nothing polls an election feed.
- Poll close times are verified only for FL (7:00 PM ET, panhandle noted as 8:00), OH, NC (7:30), and ME, MI, TX, KS (8:00). Every other state is best-knowledge and flagged unverified in Setup. Split closes (Florida panhandle) are one clock time plus a note.
- The map is a tile cartogram, not a geographic outline.
- Alaska is seeded as a late close (midnight ET) because of ranked-choice tabulation on November 18. Maine may go to RCV. Georgia can run off under 50%. California mail counts run through November 10.
- Control totals start at the pre-election composition (Senate 53R–47D, House 218R/214D/1I/2 vacant).
- Kalshi needs the proxy above. Until it is deployed, charts stay empty and the on-air card is just the KALSHI title.
- Blocked sites leave the app via Safari, and markup stays behind.
- Export/import does not carry media blobs. HEIC and PDF depend on what that iPadOS build can draw.
- The service worker needs `http` or `https`.
- Stroke width is the size set in Setup. It does not follow Apple Pencil pressure, so strokes stay thick enough for the TV.
- The YouTube tile will not load until `VIDEO_ID` is replaced with a real id.
