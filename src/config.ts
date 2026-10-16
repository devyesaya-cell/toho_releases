import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';

export interface AppConfig {
  port: number;
  host: string;
  baseUrl: string;
  masterKey: string;
  storageDir: string;
  releasesDir: string;
  filesDir: string;
  dbPath: string;
  maxFileSizeMb: number;
}

const rootDir = process.cwd();
const storageDir = path.resolve(rootDir, process.env.STORAGE_DIR || './uploads');
const dbPath = path.resolve(rootDir, process.env.DB_PATH || './data/storage.db');

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  baseUrl: (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  masterKey: process.env.MASTER_KEY || 'vps_secret_admin_key_2026',
  storageDir,
  releasesDir: path.join(storageDir, 'releases'),
  filesDir: path.join(storageDir, 'files'),
  dbPath,
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10),
};

// Ensure directories exist
fs.mkdirSync(config.storageDir, { recursive: true });
fs.mkdirSync(config.releasesDir, { recursive: true });
fs.mkdirSync(config.filesDir, { recursive: true });
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
