import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StorageService } from './storage.service.js';
import { requireAdmin, optionalAuth } from '../auth/auth.js';
import { calculateFileHashes, sanitizeFileName } from '../../utils/hash.js';
import { config } from '../../config.js';
import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';

export async function storageRoutes(fastify: FastifyInstance) {
  // List files with search & bucket filter
  fastify.get('/storage/files', { preHandler: optionalAuth }, async (req: FastifyRequest<{
    Querystring: { bucket?: string; search?: string };
  }>, reply) => {
    const files = StorageService.listFiles(req.query.bucket, req.query.search);
    return { success: true, data: files };
  });

  // List all buckets with statistics
  fastify.get('/storage/buckets', { preHandler: optionalAuth }, async (req, reply) => {
    const buckets = StorageService.listBuckets();
    return { success: true, data: buckets };
  });

  // Get file metadata
  fastify.get('/storage/files/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const file = StorageService.getFile(req.params.id);
    if (!file) {
      return reply.status(404).send({ success: false, error: 'File not found' });
    }
    return { success: true, data: file };
  });

  // Upload file to bucket
  fastify.post('/storage/upload', { preHandler: requireAdmin }, async (req, reply) => {
    const parts = req.parts();
    let uploadedFileRecord: any = null;
    let bucket = 'general';
    let description: string | undefined;

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'bucket') bucket = String(part.value || 'general');
        if (part.fieldname === 'description') description = String(part.value || '');
      } else if (part.type === 'file') {
        const cleanBucket = bucket.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'general';
        const originalName = part.filename || 'upload.bin';
        const cleanName = sanitizeFileName(originalName);
        const storedName = `${Date.now()}_${cleanName}`;
        
        const targetDir = path.join(config.filesDir, cleanBucket);
        fs.mkdirSync(targetDir, { recursive: true });

        const targetFilePath = path.join(targetDir, storedName);
        const relativeFilePath = path.join('files', cleanBucket, storedName);

        // Stream file to disk
        await pipeline(part.file, fs.createWriteStream(targetFilePath));

        const stats = fs.statSync(targetFilePath);
        const hashes = await calculateFileHashes(targetFilePath);

        uploadedFileRecord = StorageService.saveFile({
          bucket: cleanBucket,
          original_name: originalName,
          stored_name: storedName,
          file_path: relativeFilePath,
          file_size: stats.size,
          mime_type: part.mimetype || 'application/octet-stream',
          sha256: hashes.sha256,
          md5: hashes.md5,
          is_public: true,
          description: description,
        });
      }
    }

    if (!uploadedFileRecord) {
      return reply.status(400).send({ success: false, error: 'No file uploaded in request' });
    }

    return reply.status(201).send({ success: true, data: uploadedFileRecord });
  });

  // Delete file
  fastify.delete('/storage/files/:id', { preHandler: requireAdmin }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const success = StorageService.deleteFile(req.params.id);
    if (!success) {
      return reply.status(404).send({ success: false, error: 'File not found' });
    }
    return { success: true, message: 'File deleted from disk and database' };
  });

  // Download file via API endpoint
  const downloadHandler = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const file = StorageService.getFile(req.params.id);
    if (!file) {
      return reply.status(404).send({ success: false, error: 'File not found' });
    }

    const fullPath = path.resolve(config.storageDir, file.file_path);
    if (!fs.existsSync(fullPath)) {
      return reply.status(404).send({ success: false, error: 'Physical file not found on disk' });
    }

    // Increment download count
    StorageService.incrementDownload(file.id);

    reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
    reply.header('Content-Type', file.mime_type || 'application/octet-stream');
    reply.header('X-Checksum-SHA256', file.sha256);
    reply.header('X-Checksum-MD5', file.md5);

    const stream = fs.createReadStream(fullPath);
    return reply.send(stream);
  };

  fastify.get('/storage/download/:id', downloadHandler);
  fastify.get('/storage/download/:id/:fileName', downloadHandler);
}
