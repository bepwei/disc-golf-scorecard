# Disc Golf Scorecard

A web scorecard for disc golf. Saved courses, any number of players, signed
handicaps, live standings, and a one-tap Strava description. Everything lives
in `localStorage`, so a round survives fully quitting the browser.

No build step, no dependencies, no backend — plain HTML, CSS and ES modules.

## Running it locally

```bash
node serve.js
```

Then open <http://localhost:5173>. Pass a port to change it: `node serve.js 8080`.

The server prints a LAN address too, so you can open the app on your phone
while both devices are on the same Wi‑Fi.

## Putting it on your iPhone

Open the app in Safari, then **Share → Add to Home Screen**. It launches
full-screen with no browser chrome and works with no signal, which is the point
out on a course.

Two caveats when testing over the LAN address rather than `localhost`:

- Service workers need HTTPS or localhost, so **offline caching is off** over
  plain `http://192.168.…`. Host the folder anywhere with HTTPS (any static
  host works — it is just files) and offline works properly.
- The clipboard API is also HTTPS-only. The copy button falls back to selecting
  the Strava line so you can tap iOS's own **Copy**.

## Using it

1. **Courses → New** — name it, pick 9 or 18 holes, set the par for each hole.
   Every hole defaults to par 3, so usually you only adjust a few. Courses are
   saved and reused for future rounds.
2. **Start a round** — pick the course, add players, star yourself (★), and give
   anyone a handicap. The star decides whose score the Strava line reports.
3. **Score it** — the **Holes** tab shows one hole at a time with big steppers.
   The greyed number is the hole's par: tap it to take par, or tap −/+ for a
   birdie/bogey in one tap. **Card** is the full grid for corrections (clear a
   cell to mark a hole unplayed). **Standings** is the live leaderboard.
4. **Finish** — the summary has your Strava line with a copy button. **Save to
   history** files the round away; **Back to scoring** reopens it if you spot a
   mistake.

### How the numbers work

- **+/- to par** only counts holes that actually have a score, so it stays
  honest mid-round.
- **Handicap** is a signed adjustment on the round total: `+3` adds three
  strokes, `-3` removes three. Standings sort by the adjusted score; the raw
  total is always shown next to it.
- **The Strava line uses raw strokes**, before any handicap — it should reflect
  what you actually threw. Format: `Bicentennial Park — 54 (-3)`, with `E` for
  even par.
- **Pars are copied into a round when it starts.** Editing or deleting a course
  later never rewrites a round you have already played.

## Players per round

There is no cap. Up to six players fit on an iPhone 15 Pro without scrolling;
beyond that the card list simply starts scrolling and the grid view scrolls
sideways with the hole column pinned.

## Tests

```bash
node --test
```

Covers the scoring math in `js/scoring.js` — totals, partial rounds, signed
handicaps, leaderboard sorting and ties, and the Strava string.

## Layout

```
index.html              app shell
css/styles.css          all styling, light + dark
js/
  app.js                hash router
  scoring.js            pure scoring math (unit tested, no DOM)
  state.js              data model + every mutation, writes through to localStorage
  storage.js            guarded localStorage wrapper
  ui.js                 DOM helpers, toast, clipboard
  views/                one module per screen
sw.js                   service worker — caches the shell for offline use
manifest.webmanifest    PWA manifest
serve.js                zero-dependency static server
tools/make-icons.js     regenerates icons/ (node tools/make-icons.js)
test/scoring.test.js    scoring math tests
```

### Changing the app

Edit and reload — there is nothing to rebuild. The one gotcha is the service
worker: it serves from cache first, so after editing you may need a second
reload to see changes. Bump `CACHE_VERSION` in `sw.js` when you deploy, or
unregister the worker in dev tools while developing.

Your data lives under the `discgolf.v1.*` keys in `localStorage`.
