CREATE TABLE IF NOT EXISTS library_players (
  internal_name TEXT PRIMARY KEY,
  display_name TEXT,
  tracker_type TEXT,
  tracker_name TEXT,
  crop_left INTEGER,
  crop_right INTEGER,
  crop_top INTEGER,
  crop_bottom INTEGER,
  racetime_name TEXT,
  twitch_name TEXT
);
