mod data;
mod handlers;

use axum::routing::{get, post};
use axum::Router;
use std::sync::Arc;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;

use data::OrderStore;

#[derive(Clone)]
pub struct AppState {
    pub orders: Arc<OrderStore>,
    pub team_path: Arc<str>,
    pub events_path: Arc<str>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let allowed_origin =
        std::env::var("ALLOWED_ORIGIN").unwrap_or_else(|_| "http://localhost:8080".to_string());
    let database_path =
        std::env::var("DATABASE_PATH").unwrap_or_else(|_| "data/contacts.db".to_string());
    let team_path = std::env::var("TEAM_PATH").unwrap_or_else(|_| "data/team.json".to_string());
    let events_path =
        std::env::var("EVENTS_PATH").unwrap_or_else(|_| "data/events.json".to_string());
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "../frontend".to_string());

    let state = AppState {
        orders: Arc::new(OrderStore::open(&database_path).expect("failed to open database")),
        team_path: team_path.into(),
        events_path: events_path.into(),
    };

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::exact(
            allowed_origin
                .parse()
                .expect("ALLOWED_ORIGIN must be a valid origin"),
        ))
        .allow_methods([axum::http::Method::GET, axum::http::Method::POST])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    // The API lives under /api/*; anything else falls through to the static
    // frontend (index.html, styles.css, script.js, frames/...), so the site
    // and its API are served from a single origin/port with `cargo run`.
    let api = Router::new()
        .route("/team", get(handlers::get_team))
        .route("/events", get(handlers::get_events))
        .route("/order", post(handlers::order))
        .layer(cors)
        .with_state(state);

    let app = Router::new()
        .nest("/api", api)
        .fallback_service(ServeDir::new(&static_dir))
        .layer(TraceLayer::new_for_http());

    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind");
    tracing::info!("listening on {addr}, serving static files from {static_dir}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to listen for ctrl_c");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutting down...");
}
