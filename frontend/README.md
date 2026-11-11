# Frontend

Plain `index.html` + `styles.css` + `script.js`. No build step, no npm install
required to run it — the Rust backend (`../backend`) serves these files
directly, so `cargo run` there is all you need:

```sh
cd ../backend
cargo run
```

Then open http://localhost:8080.

If you want to iterate on just the frontend without a running backend, any
static file server works (e.g. `python3 -m http.server 8000` from this
directory) — Team/Events/the order form will just fall back to placeholder
content / a "could not reach the server" message until the backend is up.

## Files

- `index.html` — all markup.
- `styles.css` — all styling, including the glass nav pill and scroll-reveal transitions.
- `script.js` — the scroll-scrubbed `<canvas>` background, the nav reveal,
  `IntersectionObserver`-based reveal-on-scroll, and the `fetch()` calls to
  the backend (team/events/order form).
- `frames/landscape/` — the background animation's webp frame sequence.

## Headless browser testing

`flake.nix` provisions Chromium (via nixpkgs' `playwright-driver`) in the dev
shell and points `PLAYWRIGHT_BROWSERS_PATH` at it, so the `playwright` npm
package can drive a real browser without downloading its own copy. This is
optional tooling for verifying changes — not something the site itself needs:

```sh
nix develop
npm init -y && npm install playwright@1.64.1  # once, in a scratch dir
node -e '
import("playwright").then(async ({ chromium }) => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:8080");
  await page.screenshot({ path: "/tmp/shot.png" });
  await browser.close();
});
'
```

Pin the `playwright` version to whatever `nix eval nixpkgs#playwright-driver.version`
reports, so the driver and browser revisions match. Outside the flake's shell
(or on a system `playwright-driver` doesn't support, e.g. x86_64-darwin), fall
back to `npx playwright install chromium` to fetch a browser the normal way.
