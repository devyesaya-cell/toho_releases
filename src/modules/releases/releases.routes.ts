import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReleasesService } from './releases.service.js';
import { requireAdmin, optionalAuth } from '../auth/auth.js';
import { calculateFileHashes, sanitizeFileName } from '../../utils/hash.js';
import { config } from '../../config.js';
import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';

export async function releasesRoutes(fastify: FastifyInstance) {
  // ==================== APPS ====================
  fastify.get('/apps', { preHandler: optionalAuth }, async (req, reply) => {
    const apps = ReleasesService.listApps();
    return { success: true, data: apps };
  });

  fastify.post('/apps', { preHandler: requireAdmin }, async (req: FastifyRequest<{ Body: { id: string; name: string; description?: string } }>, reply) => {
    const { id, name, description } = req.body || {};
    if (!id || !name) {
      return reply.status(400).send({ success: false, error: 'id and name are required' });
    }
    try {
      const app = ReleasesService.createApp(id, name, description);
      return reply.status(201).send({ success: true, data: app });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message || 'Failed to create app' });
    }
  });

  fastify.delete('/apps/:id', { preHandler: requireAdmin }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const success = ReleasesService.deleteApp(req.params.id);
    if (!success) {
      return reply.status(404).send({ success: false, error: 'App not found' });
    }
    return { success: true, message: 'App and associated releases deleted' };
  });

  // ==================== RELEASES ====================
  fastify.get('/releases', { preHandler: optionalAuth }, async (req: FastifyRequest<{ Querystring: { app?: string; platform?: string } }>, reply) => {
    const releases = ReleasesService.listReleases(req.query.app, req.query.platform);
    return { success: true, data: releases };
  });

  // Auto-Update Checker for Client Apps (Flutter, Android, Windows)
  fastify.get('/releases/latest', async (req: FastifyRequest<{
    Querystring: {
      app: string;
      platform?: string;
      current_version?: string;
      current_build?: string;
      prerelease?: string;
    };
  }>, reply) => {
    const { app, platform, current_version, current_build, prerelease } = req.query;
    if (!app) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required query parameter: app (e.g. ?app=toho_egs)',
      });
    }

    const result = ReleasesService.getLatestRelease({
      appId: app,
      platform: platform || 'all',
      currentVersion: current_version,
      currentBuildNumber: current_build ? parseInt(current_build, 10) : undefined,
      allowPrerelease: prerelease === 'true' || prerelease === '1',
    });

    return {
      success: true,
      data: result,
    };
  });

  fastify.get('/releases/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const release = ReleasesService.getRelease(req.params.id);
    if (!release) {
      return reply.status(404).send({ success: false, error: 'Release not found' });
    }
    return { success: true, data: release };
  });

  fastify.post('/releases', { preHandler: requireAdmin }, async (req: FastifyRequest<{
    Body: {
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
    };
  }>, reply) => {
    const body = req.body;
    if (!body?.app_id || !body?.tag_name || !body?.title) {
      return reply.status(400).send({ success: false, error: 'app_id, tag_name, and title are required' });
    }

    try {
      const release = ReleasesService.createRelease(body);
      return reply.status(201).send({ success: true, data: release });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message || 'Failed to create release' });
    }
  });

  fastify.put('/releases/:id', { preHandler: requireAdmin }, async (req: FastifyRequest<{
    Params: { id: string };
    Body: any;
  }>, reply) => {
    const updated = ReleasesService.updateRelease(req.params.id, req.body as any);
    if (!updated) {
      return reply.status(404).send({ success: false, error: 'Release not found' });
    }
    return { success: true, data: updated };
  });

  fastify.delete('/releases/:id', { preHandler: requireAdmin }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const success = ReleasesService.deleteRelease(req.params.id);
    if (!success) {
      return reply.status(404).send({ success: false, error: 'Release not found' });
    }
    return { success: true, message: 'Release and attached assets deleted' };
  });

  // ==================== RELEASE ASSETS ====================
  // Upload asset file directly to a release (e.g. .apk, .exe, .zip)
  fastify.post('/releases/:id/assets', { preHandler: requireAdmin }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const release = ReleasesService.getRelease(req.params.id);
    if (!release) {
      return reply.status(404).send({ success: false, error: 'Release not found' });
    }

    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ success: false, error: 'No file uploaded' });
    }

    const originalName = data.filename || 'asset.bin';
    const cleanFileName = sanitizeFileName(originalName);
    const storedName = `${release.app_id}_${release.tag_name}_${Date.now()}_${cleanFileName}`;
    const targetDir = path.join(config.releasesDir, release.app_id);
    fs.mkdirSync(targetDir, { recursive: true });

    const targetFilePath = path.join(targetDir, storedName);
    const relativeFilePath = path.join('releases', release.app_id, storedName);

    // Stream file directly to disk to prevent high RAM consumption
    await pipeline(data.file, fs.createWriteStream(targetFilePath));

    const stats = fs.statSync(targetFilePath);
    const hashes = await calculateFileHashes(targetFilePath);

    const asset = ReleasesService.addReleaseAsset({
      release_id: release.id,
      file_name: originalName,
      stored_name: storedName,
      file_path: relativeFilePath,
      file_size: stats.size,
      mime_type: data.mimetype || 'application/octet-stream',
      sha256: hashes.sha256,
      md5: hashes.md5,
    });

    return reply.status(201).send({ success: true, data: asset });
  });

  fastify.delete('/releases/assets/:assetId', { preHandler: requireAdmin }, async (req: FastifyRequest<{ Params: { assetId: string } }>, reply) => {
    const success = ReleasesService.deleteAsset(req.params.assetId);
    if (!success) {
      return reply.status(404).send({ success: false, error: 'Asset not found' });
    }
    return { success: true, message: 'Asset deleted' };
  });

  // Download release asset (Streams file directly, counts downloads)
  const downloadHandler = async (req: FastifyRequest<{ Params: { assetId: string } }>, reply: FastifyReply) => {
    const asset = ReleasesService.getAsset(req.params.assetId);
    if (!asset) {
      return reply.status(404).send({ success: false, error: 'Asset not found' });
    }

    const fullPath = path.resolve(config.storageDir, asset.file_path);
    if (!fs.existsSync(fullPath)) {
      return reply.status(404).send({ success: false, error: 'Physical file not found on disk' });
    }

    // Increment download count
    ReleasesService.incrementAssetDownload(asset.id);

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(asset.file_name)}"`);
    reply.header('Content-Type', asset.mime_type || 'application/octet-stream');
    reply.header('X-Checksum-SHA256', asset.sha256);
    reply.header('X-Checksum-MD5', asset.md5);

    const stream = fs.createReadStream(fullPath);
    return reply.send(stream);
  };

  fastify.get('/releases/download/:assetId', downloadHandler);
  fastify.get('/releases/download/:assetId/:fileName', downloadHandler);
}
