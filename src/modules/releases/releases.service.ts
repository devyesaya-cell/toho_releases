import { getDb } from '../../db/index.js';
import { config } from '../../config.js';
import fs from 'node:fs';
import path from 'node:path';

export interface AppRecord {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  release_count?: number;
}

export interface ReleaseAssetRecord {
  id: string;
  release_id: string;
  file_name: string;
  stored_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  sha256: string;
  md5: string;
  download_count: number;
  created_at: number;
  download_url?: string;
}

export interface ReleaseRecord {
  id: string;
  app_id: string;
  app_name?: string;
  tag_name: string;
  title: string;
  release_notes: string | null;
  target_platform: string;
  build_number: number;
  min_supported_version: string | null;
  is_prerelease: number;
  is_mandatory: number;
  status: 'published' | 'draft' | 'deprecated';
  created_at: number;
  published_at: number | null;
  assets?: ReleaseAssetRecord[];
}

export class ReleasesService {
  static listApps(): AppRecord[] {
    const db = getDb();
    const rows = (db.prepare(`
      SELECT a.*, COUNT(r.id) as release_count
      FROM apps a
      LEFT JOIN releases r ON a.id = r.app_id
      GROUP BY a.id
      ORDER BY a.name ASC
    `).all() as unknown) as (AppRecord & { release_count: number })[];
    return rows;
  }

  static getApp(id: string): AppRecord | null {
    const db = getDb();
    const row = (db.prepare('SELECT * FROM apps WHERE id = ?').get(id) as unknown) as AppRecord | undefined;
    return row || null;
  }

  static createApp(id: string, name: string, description?: string): AppRecord {
    const db = getDb();
    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO apps (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `).run(cleanId, name.trim(), description?.trim() || null, now);
    return { id: cleanId, name, description: description || null, created_at: now };
  }

  static deleteApp(id: string): boolean {
    const db = getDb();
    // Get all releases to delete physical assets
    const releases = db.prepare('SELECT id FROM releases WHERE app_id = ?').all(id) as { id: string }[];
    for (const r of releases) {
      this.deleteRelease(r.id);
    }
    const result = db.prepare('DELETE FROM apps WHERE id = ?').run(id);
    return result.changes > 0;
  }

  static listReleases(appId?: string, platform?: string): ReleaseRecord[] {
    const db = getDb();
    let query = `
      SELECT r.*, a.name as app_name
      FROM releases r
      JOIN apps a ON r.app_id = a.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (appId) {
      query += ' AND r.app_id = ?';
      params.push(appId);
    }

    if (platform && platform !== 'all') {
      query += " AND (r.target_platform = ? OR r.target_platform = 'all')";
      params.push(platform);
    }

    query += ' ORDER BY r.build_number DESC, r.created_at DESC';

    const releases = (db.prepare(query).all(...params) as unknown) as ReleaseRecord[];

    // Attach assets for each release
    for (const rel of releases) {
      rel.assets = this.getReleaseAssets(rel.id);
    }

    return releases;
  }

  static getRelease(id: string): ReleaseRecord | null {
    const db = getDb();
    const rel = (db.prepare(`
      SELECT r.*, a.name as app_name
      FROM releases r
      JOIN apps a ON r.app_id = a.id
      WHERE r.id = ?
    `).get(id) as unknown) as ReleaseRecord | undefined;

    if (!rel) return null;
    rel.assets = this.getReleaseAssets(rel.id);
    return rel;
  }

  static getReleaseAssets(releaseId: string): ReleaseAssetRecord[] {
    const db = getDb();
    const assets = (db.prepare(`
      SELECT * FROM release_assets WHERE release_id = ? ORDER BY created_at ASC
    `).all(releaseId) as unknown) as ReleaseAssetRecord[];

    return assets.map(a => ({
      ...a,
      download_url: `${config.baseUrl}/api/v1/releases/download/${a.id}/${encodeURIComponent(a.file_name)}`,
    }));
  }

  static createRelease(data: {
    app_id: string;
    tag_name: string;
    title: string;
    release_notes?: string;
    target_platform?: string;
    build_number?: number;
    min_supported_version?: string;
    is_prerelease?: boolean;
    is_mandatory?: boolean;
    status?: 'published' | 'draft' | 'deprecated';
  }): ReleaseRecord {
    const db = getDb();
    const id = 'rel_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const now = Math.floor(Date.now() / 1000);
    const status = data.status || 'published';
    const publishedAt = status === 'published' ? now : null;

    db.prepare(`
      INSERT INTO releases (
        id, app_id, tag_name, title, release_notes, target_platform,
        build_number, min_supported_version, is_prerelease, is_mandatory,
        status, created_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.app_id,
      data.tag_name.trim(),
      data.title.trim(),
      data.release_notes?.trim() || null,
      data.target_platform?.toLowerCase() || 'all',
      data.build_number || 1,
      data.min_supported_version?.trim() || null,
      data.is_prerelease ? 1 : 0,
      data.is_mandatory ? 1 : 0,
      status,
      now,
      publishedAt
    );

    return this.getRelease(id)!;
  }

  static updateRelease(id: string, data: Partial<ReleaseRecord>): ReleaseRecord | null {
    const db = getDb();
    const existing = this.getRelease(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (data.tag_name !== undefined) { fields.push('tag_name = ?'); values.push(data.tag_name.trim()); }
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title.trim()); }
    if (data.release_notes !== undefined) { fields.push('release_notes = ?'); values.push(data.release_notes?.trim() || null); }
    if (data.target_platform !== undefined) { fields.push('target_platform = ?'); values.push(data.target_platform); }
    if (data.build_number !== undefined) { fields.push('build_number = ?'); values.push(data.build_number); }
    if (data.min_supported_version !== undefined) { fields.push('min_supported_version = ?'); values.push(data.min_supported_version?.trim() || null); }
    if (data.is_prerelease !== undefined) { fields.push('is_prerelease = ?'); values.push(data.is_prerelease ? 1 : 0); }
    if (data.is_mandatory !== undefined) { fields.push('is_mandatory = ?'); values.push(data.is_mandatory ? 1 : 0); }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
      if (data.status === 'published' && !existing.published_at) {
        fields.push('published_at = ?');
        values.push(Math.floor(Date.now() / 1000));
      }
    }

    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE releases SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.getRelease(id);
  }

  static deleteRelease(id: string): boolean {
    const db = getDb();
    const assets = this.getReleaseAssets(id);
    // Delete physical files
    for (const asset of assets) {
      const fullPath = path.resolve(config.storageDir, asset.file_path);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch {}
      }
    }

    const result = db.prepare('DELETE FROM releases WHERE id = ?').run(id);
    return result.changes > 0;
  }

  static addReleaseAsset(data: {
    release_id: string;
    file_name: string;
    stored_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    sha256: string;
    md5: string;
  }): ReleaseAssetRecord {
    const db = getDb();
    const id = 'ast_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO release_assets (
        id, release_id, file_name, stored_name, file_path,
        file_size, mime_type, sha256, md5, download_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id,
      data.release_id,
      data.file_name,
      data.stored_name,
      data.file_path,
      data.file_size,
      data.mime_type,
      data.sha256,
      data.md5,
      now
    );

    return {
      id,
      ...data,
      download_count: 0,
      created_at: now,
      download_url: `${config.baseUrl}/api/v1/releases/download/${id}/${encodeURIComponent(data.file_name)}`,
    };
  }

  static getAsset(assetId: string): ReleaseAssetRecord | null {
    const db = getDb();
    const asset = (db.prepare('SELECT * FROM release_assets WHERE id = ?').get(assetId) as unknown) as ReleaseAssetRecord | undefined;
    if (!asset) return null;
    return {
      ...asset,
      download_url: `${config.baseUrl}/api/v1/releases/download/${asset.id}/${encodeURIComponent(asset.file_name)}`,
    };
  }

  static deleteAsset(assetId: string): boolean {
    const db = getDb();
    const asset = this.getAsset(assetId);
    if (!asset) return false;

    const fullPath = path.resolve(config.storageDir, asset.file_path);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch {}
    }

    const result = db.prepare('DELETE FROM release_assets WHERE id = ?').run(assetId);
    return result.changes > 0;
  }

  static incrementAssetDownload(assetId: string): void {
    const db = getDb();
    db.prepare('UPDATE release_assets SET download_count = download_count + 1 WHERE id = ?').run(assetId);
  }

  /**
   * The core Auto-Update Checker for Client Apps (Flutter, Android, Desktop).
   * Checks whether an update exists and whether it is mandatory.
   */
  static getLatestRelease(params: {
    appId: string;
    platform?: string;
    currentVersion?: string;
    currentBuildNumber?: number;
    allowPrerelease?: boolean;
  }) {
    const db = getDb();
    let query = `
      SELECT r.*, a.name as app_name
      FROM releases r
      JOIN apps a ON r.app_id = a.id
      WHERE r.app_id = ? AND r.status = 'published'
    `;
    const sqlParams: (string | number)[] = [params.appId];

    if (!params.allowPrerelease) {
      query += ' AND r.is_prerelease = 0';
    }

    if (params.platform && params.platform !== 'all') {
      query += " AND (r.target_platform = ? OR r.target_platform = 'all')";
      sqlParams.push(params.platform);
    }

    query += ' ORDER BY r.build_number DESC, r.created_at DESC LIMIT 1';

    const latest = (db.prepare(query).get(...sqlParams) as unknown) as ReleaseRecord | undefined;

    if (!latest) {
      return {
        has_update: false,
        message: 'No releases found for this application',
      };
    }

    const assets = this.getReleaseAssets(latest.id);
    latest.assets = assets;

    // Check if client is out of date
    let hasUpdate = true;
    let isMandatory = latest.is_mandatory === 1;

    if (params.currentBuildNumber !== undefined) {
      hasUpdate = latest.build_number > params.currentBuildNumber;
    } else if (params.currentVersion) {
      const cleanCurrent = params.currentVersion.replace(/^v/i, '').trim();
      const cleanLatest = latest.tag_name.replace(/^v/i, '').trim();
      hasUpdate = cleanCurrent !== cleanLatest;
    }

    // Check minimum supported version enforcement
    if (latest.min_supported_version && params.currentVersion) {
      const cleanMin = latest.min_supported_version.replace(/^v/i, '').trim();
      const cleanCurrent = params.currentVersion.replace(/^v/i, '').trim();
      // If client version is lower than min_supported_version, force mandatory update
      if (cleanCurrent < cleanMin) {
        isMandatory = true;
      }
    }

    // Determine primary download asset (e.g. apk if android, exe if windows, or first asset)
    let primaryAsset: ReleaseAssetRecord | null = null;
    if (assets.length > 0) {
      if (params.platform === 'android') {
        primaryAsset = assets.find(a => a.file_name.endsWith('.apk')) || assets[0];
      } else if (params.platform === 'windows') {
        primaryAsset = assets.find(a => a.file_name.endsWith('.exe') || a.file_name.endsWith('.msix') || a.file_name.endsWith('.zip')) || assets[0];
      } else {
        primaryAsset = assets[0];
      }
    }

    return {
      has_update: hasUpdate,
      is_mandatory: isMandatory,
      app_id: latest.app_id,
      app_name: latest.app_name,
      latest_version: latest.tag_name,
      build_number: latest.build_number,
      release_title: latest.title,
      release_notes: latest.release_notes,
      published_at: latest.published_at,
      target_platform: latest.target_platform,
      primary_asset: primaryAsset ? {
        file_name: primaryAsset.file_name,
        download_url: primaryAsset.download_url,
        file_size: primaryAsset.file_size,
        sha256: primaryAsset.sha256,
        md5: primaryAsset.md5,
      } : null,
      assets: assets.map(a => ({
        id: a.id,
        file_name: a.file_name,
        download_url: a.download_url,
        file_size: a.file_size,
        sha256: a.sha256,
        mime_type: a.mime_type,
      })),
    };
  }
}
