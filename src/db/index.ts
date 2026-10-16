import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  dbInstance = new DatabaseSync(config.dbPath);
  
  // Enable WAL mode and Foreign Keys for high performance & integrity
  dbInstance.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  initSchema(dbInstance);
  seedDefaultData(dbInstance);

  return dbInstance;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS releases (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      tag_name TEXT NOT NULL,
      title TEXT NOT NULL,
      release_notes TEXT,
      target_platform TEXT NOT NULL DEFAULT 'all',
      build_number INTEGER NOT NULL DEFAULT 1,
      min_supported_version TEXT,
      is_prerelease INTEGER NOT NULL DEFAULT 0,
      is_mandatory INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      created_at INTEGER NOT NULL,
      published_at INTEGER,
      FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS release_assets (
      id TEXT PRIMARY KEY,
      release_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      md5 TEXT NOT NULL,
      download_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS storage_files (
      id TEXT PRIMARY KEY,
      bucket TEXT NOT NULL DEFAULT 'general',
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      md5 TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 1,
      download_count INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'read',
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_releases_app_id ON releases(app_id);
    CREATE INDEX IF NOT EXISTS idx_releases_tag ON releases(app_id, tag_name);
    CREATE INDEX IF NOT EXISTS idx_assets_release ON release_assets(release_id);
    CREATE INDEX IF NOT EXISTS idx_storage_bucket ON storage_files(bucket);
    CREATE INDEX IF NOT EXISTS idx_storage_created ON storage_files(created_at);
  `);
}

function seedDefaultData(db: DatabaseSync): void {
  // Check if default app exists
  const appsCount = db.prepare('SELECT COUNT(*) as count FROM apps').get() as { count: number };
  if (appsCount.count === 0) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO apps (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `).run('toho_egs', 'Toho EGS Guidance System', 'Excavator Guidance System client application for Android & Windows', now);
  }

  // Check if master API key is seeded
  const keysCount = db.prepare('SELECT COUNT(*) as count FROM api_keys').get() as { count: number };
  if (keysCount.count === 0) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO api_keys (id, name, key, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('key_master', 'Master Administrator Key', config.masterKey, 'admin', now);

    // Also create a sample read-only client key
    db.prepare(`
      INSERT INTO api_keys (id, name, key, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('key_client_public', 'Client App Public Read Key', 'vps_client_readonly_key_2026', 'read', now);
  }
}
