import { getDb } from '../../db/index.js';
import crypto from 'node:crypto';

export interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  role: 'admin' | 'read';
  created_at: number;
  last_used_at: number | null;
}

export class KeysService {
  static listKeys(): ApiKeyRecord[] {
    const db = getDb();
    const rows = (db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all() as unknown) as ApiKeyRecord[];
    return rows;
  }

  static createKey(name: string, role: 'admin' | 'read' = 'read'): ApiKeyRecord {
    const db = getDb();
    const id = 'key_' + Math.random().toString(36).substring(2, 10);
    const generatedKey = `vps_${role}_` + crypto.randomBytes(24).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO api_keys (id, name, key, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name.trim(), generatedKey, role, now);

    return {
      id,
      name: name.trim(),
      key: generatedKey,
      role,
      created_at: now,
      last_used_at: null,
    };
  }

  static deleteKey(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
