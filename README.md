# Campaign site template

Animated frontend + lightweight backend, built for a school association election
campaign (but generic enough to adapt for anything similar).

- `frontend/` — plain `index.html` + `styles.css` + `script.js`. No build step,
  no framework: a scroll-scrubbed `<canvas>` background, a glassmorphism nav
  widget that fades in as you scroll, and reveal-on-scroll animations via
  `IntersectionObserver`.
- `backend/` — Rust REST API (Axum): serves the team roster, event timeline,
  handles the order form, **and serves the static frontend itself**, so one
  process is the whole site.

## Toolchain

`flake.nix` gives you a C linker (`nix develop`), which `cargo` needs. Rust
itself is managed by **rustup** (see `backend/rust-toolchain.toml`), not Nix —
run `cargo` as usual and rustup will auto-install the pinned toolchain if it's
missing. See `backend/README.md` for why it's split this way. Node.js is only
in the shell for optional Playwright-based testing, not to run the site.

## Quick start

```sh
cd backend
cargo run
```

Open http://localhost:8080 — that's it. The Rust server serves `index.html`,
`styles.css`, `script.js`, and the frame images from `frontend/`, alongside
its own `/api/*` routes, so there's nothing else to start.

## Structure

- `frontend/index.html` — all markup: nav, hero, program, team, events, order form, footer.
- `frontend/styles.css` — all styling, including the glass nav and scroll-reveal transitions.
- `frontend/script.js` — the scroll-driven background, nav reveal, reveal-on-scroll,
  and the `fetch()` calls that populate Team/Events and submit the order form.
- `frontend/frames/landscape/` — the background's webp frame sequence.
- `backend/src/data.rs` — seed data (team, events) and the SQLite-backed order
  store; swap for a real database when you need persistence.
- `backend/src/handlers.rs` / `main.rs` — request handlers, routing, static
  file serving, CORS/tracing middleware.

## Customizing for your campaign

- Edit the copy directly in `frontend/index.html`, and the placeholder
  team/events in `backend/src/data.rs`.
- Update colors/fonts via the CSS variables at the top of `frontend/styles.css`.
- If you ever split the frontend onto a different origin than the backend,
  set `window.API_URL` before `script.js` loads, and set `ALLOWED_ORIGIN` on
  the backend to match.
