import type { SQLiteAPI } from "@/lib/db/sqlite-types";

const CORE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nickname TEXT DEFAULT 'Paso Walker',
    created_at TEXT DEFAULT (datetime('now')),
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    settings_json TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS pois (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    geofence_radius_m INTEGER DEFAULT 50,
    region TEXT,
    district TEXT,
    source TEXT DEFAULT 'official',
    base_xp INTEGER DEFAULT 10
  );

  CREATE INDEX IF NOT EXISTS idx_pois_geo ON pois(latitude, longitude);
  CREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category);

  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    poi_id TEXT REFERENCES pois(id),
    arrived_at TEXT NOT NULL,
    departed_at TEXT,
    dwell_time_minutes INTEGER,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    gps_accuracy_m REAL,
    memo TEXT,
    mood TEXT,
    photo_ids TEXT,
    xp_earned INTEGER DEFAULT 0,
    xp_breakdown_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(arrived_at DESC);
  CREATE INDEX IF NOT EXISTS idx_visits_poi ON visits(poi_id);

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    poi_id TEXT REFERENCES pois(id),
    visit_id TEXT REFERENCES visits(id),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    text TEXT,
    tags_json TEXT,
    photo_ids TEXT,
    is_shared INTEGER DEFAULT 0,
    shared_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_visit_id ON reviews(visit_id);

  CREATE TABLE IF NOT EXISTS xp_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id TEXT,
    xp_amount INTEGER NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_visits INTEGER DEFAULT 0,
    unique_pois_visited INTEGER DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_photos INTEGER DEFAULT 0,
    total_distance_km REAL DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    steps_today INTEGER DEFAULT 0,
    steps_weekly_avg INTEGER DEFAULT 0,
    updated_at TEXT
  );

  INSERT OR IGNORE INTO profile (id) VALUES (1);
  INSERT OR IGNORE INTO stats (id, updated_at) VALUES (1, datetime('now'));
`;

const USER_PLACE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS poi_user_state (
    poi_id TEXT PRIMARY KEY REFERENCES pois(id) ON DELETE CASCADE,
    is_saved INTEGER NOT NULL DEFAULT 0 CHECK (is_saved IN (0, 1)),
    saved_at TEXT,
    personal_note TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_poi_user_state_saved
    ON poi_user_state(is_saved, saved_at DESC);

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS poi_tags (
    poi_id TEXT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (poi_id, tag_id)
  );

  CREATE INDEX IF NOT EXISTS idx_poi_tags_tag ON poi_tags(tag_id, poi_id);
`;

const VISIT_VERIFICATION_SCHEMA = `
  ALTER TABLE visits
    ADD COLUMN verification_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (verification_mode IN ('manual', 'gps'));
`;

const MIGRATIONS = [
  { version: 1, sql: CORE_SCHEMA },
  { version: 2, sql: USER_PLACE_SCHEMA },
  { version: 3, sql: VISIT_VERIFICATION_SCHEMA },
] as const;

export async function runMigrations(sqlite3: SQLiteAPI, db: number) {
  await sqlite3.exec(
    db,
    `
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  );

  const appliedResult = await sqlite3.execWithParams(
    db,
    "SELECT version FROM schema_migrations;",
  );
  const applied = new Set(appliedResult.rows.map(([version]) => Number(version)));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }

    await sqlite3.exec(db, "BEGIN IMMEDIATE;");
    try {
      await sqlite3.exec(db, migration.sql);
      await sqlite3.execWithParams(
        db,
        "INSERT INTO schema_migrations (version) VALUES (?);",
        [migration.version],
      );
      await sqlite3.exec(db, "COMMIT;");
    } catch (error) {
      try {
        await sqlite3.exec(db, "ROLLBACK;");
      } catch {
        // Keep the migration error as the actionable failure.
      }
      throw error;
    }
  }
}
