use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use serde::{Deserialize, Serialize};

use crate::data::{events, team};
use crate::AppState;

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

#[derive(Serialize)]
struct OkBody {
    ok: bool,
}

pub async fn get_team(State(state): State<AppState>) -> impl IntoResponse {
    Json(team(&state.team_path))
}

pub async fn get_events(State(state): State<AppState>) -> impl IntoResponse {
    Json(events(&state.events_path))
}

#[derive(Deserialize)]
pub struct OrderRequest {
    #[serde(default)]
    first_name: String,
    #[serde(default)]
    last_name: String,
    #[serde(default)]
    residence: String,
    #[serde(default)]
    room_number: String,
    #[serde(default)]
    phone_number: String,
    #[serde(default)]
    food: String,
}

pub async fn order(
    State(state): State<AppState>,
    Json(req): Json<OrderRequest>,
) -> impl IntoResponse {
    let first_name = req.first_name.trim().to_string();
    let last_name = req.last_name.trim().to_string();
    let residence = req.residence.trim().to_string();
    let room_number = req.room_number.trim().to_string();
    let phone_number = req.phone_number.trim().to_string();
    let food = req.food.trim().to_string();

    if [
        &first_name,
        &last_name,
        &residence,
        &room_number,
        &phone_number,
        &food,
    ]
    .iter()
    .any(|field| field.is_empty())
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                error: "All fields are required.".into(),
            }),
        )
            .into_response();
    }

    let orders = state.orders.clone();
    let result = tokio::task::spawn_blocking(move || {
        orders.add(
            first_name,
            last_name,
            residence,
            room_number,
            phone_number,
            food,
        )
    })
    .await
    .expect("order store task panicked");

    match result {
        Ok(()) => (StatusCode::CREATED, Json(OkBody { ok: true })).into_response(),
        Err(err) => {
            tracing::error!("failed to store order: {err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorBody {
                    error: "Could not save your order.".into(),
                }),
            )
                .into_response()
        }
    }
}
