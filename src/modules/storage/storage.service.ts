import { getDb } from '../../db/index.js';
import { config } from '../../config.js';
import fs from 'node:fs';
import path from 'node:path';

export interface StorageFileRecord {
  id: string;
  bucket: string;
  original_name: string;
  stored_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  sha256: string;
  md5: string;
  is_public: number;
  download_count: number;
  description: string | null;
  created_at: number;
  public_url?: string;
  download_url?: string;
}

export class StorageService {
  static listFiles(bucket?: string, search?: string): StorageFileRecord[] {
    const db = getDb();
    let query = 'SELECT * FROM storage_files WHERE 1=1';
    const params: (string | number)[] = [];

    if (bucket && bucket !== 'all') {
      query += ' AND bucket = ?';
      params.push(bucket);
    }

    if (search) {
      query += ' AND (original_name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const files = (db.prepare(query).all(...params) as unknown) as StorageFileRecord[];

    return files.map(f => this.formatFileUrls(f));
  }

  static getFile(id: string): StorageFileRecord | null {
    const db = getDb();
    const file = (db.prepare('SELECT * FROM storage_files WHERE id = ?').get(id) as unknown) as StorageFileRecord | undefined;
    if (!file) return null;
    return this.formatFileUrls(file);
  }

  static getFileByPath(bucket: string, storedName: string): StorageFileRecord | null {
    const db = getDb();
    const file = (db.prepare('SELECT * FROM storage_files WHERE bucket = ? AND stored_name = ?').get(bucket, storedName) as unknown) as StorageFileRecord | undefined;
    if (!file) return null;
    return this.formatFileUrls(file);
  }

  static saveFile(data: {
    bucket: string;
    original_name: string;
    stored_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    sha256: string;
    md5: string;
    is_public?: boolean;
    description?: string;
  }): StorageFileRecord {
    const db = getDb();
    const id = 'file_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const now = Math.floor(Date.now() / 1000);
    const bucket = data.bucket.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'general';

    db.prepare(`
      INSERT INTO storage_files (
        id, bucket, original_name, stored_name, file_path,
        file_size, mime_type, sha256, md5, is_public,
        download_count, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      bucket,
      data.original_name,
      data.stored_name,
      data.file_path,
      data.file_size,
      data.mime_type,
      data.sha256,
      data.md5,
      data.is_public !== false ? 1 : 0,
      data.description?.trim() || null,
      now
    );

    return this.getFile(id)!;
  }

  static deleteFile(id: string): boolean {
    const db = getDb();
    const file = this.getFile(id);
    if (!file) return false;

    const fullPath = path.resolve(config.storageDir, file.file_path);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch {}
    }

    const result = db.prepare('DELETE FROM storage_files WHERE id = ?').run(id);
    return result.changes > 0;
  }

  static incrementDownload(id: string): void {
    const db = getDb();
    db.prepare('UPDATE storage_files SET download_count = download_count + 1 WHERE id = ?').run(id);
  }

  static listBuckets(): { bucket: string; file_count: number; total_size: number }[] {
    const db = getDb();
    const rows = (db.prepare(`
      SELECT bucket, COUNT(*) as file_count, SUM(file_size) as total_size
      FROM storage_files
      GROUP BY bucket
      ORDER BY bucket ASC
    `).all() as unknown) as { bucket: string; file_count: number; total_size: number }[];
    return rows;
  }

  private static formatFileUrls(file: StorageFileRecord): StorageFileRecord {
    return {
      ...file,
      public_url: `${config.baseUrl}/files/${encodeURIComponent(file.bucket)}/${encodeURIComponent(file.stored_name)}`,
      download_url: `${config.baseUrl}/api/v1/storage/download/${file.id}/${encodeURIComponent(file.original_name)}`,
    };
  }
}
