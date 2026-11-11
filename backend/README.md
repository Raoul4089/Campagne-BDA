# Backend

Rust REST API (Axum) for the campaign site. Also serves the static frontend
(`../frontend`) directly, so `cargo run` is the whole site, on one port.

## Toolchain

The Rust toolchain is managed by **rustup**, not Nix — `rust-toolchain.toml`
pins the channel (`stable`) and rustup auto-installs it on first `cargo`
invocation in this directory. The repo's `flake.nix` only adds a C linker
(`cc`) to `PATH`, which `cargo` needs to link native build scripts/proc
macros; it does not provide `rustc`/`cargo` itself, to avoid a second
toolchain shadowing rustup's.

If you're not using the flake's dev shell, just make sure a C compiler
(`gcc`/`clang`) is installed.

## Run

```sh
cargo run
```

Listens on `:8080` by default, serving `/index.html` at `/` and `/api/*`
alongside it. Configure with env vars:

- `PORT` — port to listen on (default `8080`)
- `STATIC_DIR` — directory to serve as the static site (default `../frontend`)
- `ALLOWED_ORIGIN` — origin allowed via CORS, only relevant if you serve the
  frontend from a different origin than the API (default `http://localhost:8080`)
- `DATABASE_PATH` — path to the SQLite file (default `data/contacts.db`, created on first run)
- `TEAM_PATH` — path to the team roster JSON (default `data/team.json`)
- `EVENTS_PATH` — path to the events timeline JSON (default `data/events.json`)
- `RUST_LOG` — log level, e.g. `RUST_LOG=info cargo run`

## Endpoints

- `GET /api/team` — team/candidate list, loaded from `TEAM_PATH`
- `GET /api/events` — campaign timeline, loaded from `EVENTS_PATH`
- `POST /api/order` — `{ "first_name", "last_name", "residence", "room_number", "phone_number", "food" }`, validates and stores the order in SQLite
- everything else (`GET /`, `/styles.css`, `/script.js`, `/frames/...`) — served from `STATIC_DIR`

## Extending

- `data/team.json` / `data/events.json` — edit these directly to update the team roster or event timeline; no rebuild needed, just restart (or rely on your deploy process reloading them). Missing or invalid JSON logs a warning and serves an empty list — the frontend has its own placeholder content for that case.
- `src/data.rs` — the JSON-loading helpers, and the SQLite-backed order store (`rusqlite`, bundled SQLite — no system library or separate DB server needed).
- `src/handlers.rs` — request handlers and validation.
- `src/main.rs` — `AppState` (shared config/store), routing, static file serving, CORS/tracing middleware, graceful shutdown.
