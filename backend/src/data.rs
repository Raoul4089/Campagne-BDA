use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Clone)]
pub struct TeamMember {
    pub id: String,
    pub name: String,
    pub role: String,
    pub bio: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CampaignEvent {
    pub id: String,
    pub title: String,
    pub date: String,
    pub location: String,
    pub description: String,
}

/// Loads the team roster from `path` (see data/team.json). Falls back to an
/// empty list if the file is missing or invalid — the frontend already has
/// its own placeholder content for that case.
pub fn team(path: &str) -> Vec<TeamMember> {
    load_json(path)
}

/// Loads the campaign timeline from `path` (see data/events.json). Same
/// fallback behavior as `team`.
pub fn events(path: &str) -> Vec<CampaignEvent> {
    load_json(path)
}

fn load_json<T: serde::de::DeserializeOwned>(path: &str) -> Vec<T> {
    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(err) => {
            tracing::warn!("could not read {path}: {err}");
            return Vec::new();
        }
    };

    match serde_json::from_str(&contents) {
        Ok(data) => data,
        Err(err) => {
            tracing::warn!("could not parse {path}: {err}");
            Vec::new()
        }
    }
}

#[derive(Serialize, Clone)]
pub struct Order {
    pub first_name: String,
    pub last_name: String,
    pub residence: String,
    pub room_number: String,
    pub phone_number: String,
    pub food: String,
    pub created_at: u64,
}

/// SQLite-backed store for food-order form submissions.
pub struct OrderStore {
    conn: Mutex<Connection>,
}

impl OrderStore {
    pub fn open(path: &str) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS commandes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                residence TEXT NOT NULL,
                room_number TEXT NOT NULL,
                phone_number TEXT NOT NULL,
                food TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )",
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    #[allow(clippy::too_many_arguments)]
    pub fn add(
        &self,
        first_name: String,
        last_name: String,
        residence: String,
        room_number: String,
        phone_number: String,
        food: String,
    ) -> rusqlite::Result<()> {
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        self.conn.lock().unwrap().execute(
            "INSERT INTO commandes (first_name, last_name, residence, room_number, phone_number, food, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                first_name,
                last_name,
                residence,
                room_number,
                phone_number,
                food,
                created_at as i64
            ],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn all(&self) -> rusqlite::Result<Vec<Order>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT first_name, last_name, residence, room_number, phone_number, food, created_at
             FROM commandes ORDER BY id",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Order {
                first_name: row.get(0)?,
                last_name: row.get(1)?,
                residence: row.get(2)?,
                room_number: row.get(3)?,
                phone_number: row.get(4)?,
                food: row.get(5)?,
                created_at: row.get::<_, i64>(6)? as u64,
            })
        })?;
        rows.collect()
    }
}
