CREATE TABLE IF NOT EXISTS races (
  race_id TEXT PRIMARY KEY,
  name TEXT,
  api_key TEXT,
  state TEXT DEFAULT 'Ready for Stream',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  twitch_channel TEXT
);

CREATE TABLE IF NOT EXISTS players (
  player_id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id TEXT,
  backend_name TEXT,
  display_name TEXT,
  collected_items TEXT,
  dungeons_seen TEXT,
  dungeons_with_triforce TEXT,
  FOREIGN KEY (race_id) REFERENCES races(race_id)
);

CREATE TABLE IF NOT EXISTS race_items (
  race_id TEXT,
  item_name TEXT,
  location TEXT,
  required TEXT DEFAULT NULL,
  PRIMARY KEY (race_id, item_name),
  FOREIGN KEY (race_id) REFERENCES races(race_id)
);
