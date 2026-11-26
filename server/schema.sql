PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS config (id TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS quotes (
 id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, access_hash TEXT NOT NULL UNIQUE,
 customer_name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, detail_address TEXT NOT NULL,
 lat REAL, lng REAL, preferred_date TEXT NOT NULL, preferred_time TEXT NOT NULL,
 items TEXT NOT NULL, customer_note TEXT NOT NULL, consent_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'received', amount INTEGER, visit_at TEXT,
 admin_note TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1, last_action TEXT,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS quotes_created ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_date ON quotes(preferred_date,status);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_quote ON events(quote_id,created_at);
CREATE TABLE IF NOT EXISTS photos (
 id TEXT PRIMARY KEY, quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
 mime TEXT NOT NULL, bytes INTEGER NOT NULL, content BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS photos_quote ON photos(quote_id);
CREATE TABLE IF NOT EXISTS limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS geo_cache (id TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL);
