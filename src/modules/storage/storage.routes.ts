import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StorageService } from './storage.service.js';
import { requireAdmin, optionalAuth } from '../auth/auth.js';
import { calculateFileHashes, sanitizeFileName } from '../../utils/hash.js';
import { config } from '../../config.js';
import { ChunkManager, moveFile } from '../../utils/chunkManager.js';
import path from 'node:path';
import fs from 'node:fs';

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

  // Upload file to bucket (supports chunked upload for 2MB limit)
  fastify.post('/storage/upload', { preHandler: requireAdmin }, async (req: FastifyRequest<{
    Querystring: {
      uploadId?: string;
      chunkIndex?: string;
      totalChunks?: string;
      fileName?: string;
      fileSize?: string;
      bucket?: string;
    };
  }>, reply) => {
    const q = req.query || {};
    let uploadId = q.uploadId || '';
    let chunkIndex = q.chunkIndex !== undefined ? parseInt(q.chunkIndex, 10) : 0;
    let totalChunks = q.totalChunks !== undefined ? parseInt(q.totalChunks, 10) : 1;
    let rawFileName = q.fileName || '';
    let fileSize = q.fileSize !== undefined ? parseInt(q.fileSize, 10) : 0;
    let bucket = q.bucket || 'general';
    let description: string | undefined;

    let mimeType = 'application/octet-stream';
    let fileUploaded = false;
    let chunkResult: { isComplete: boolean; mergedFilePath?: string } | null = null;

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'uploadId') uploadId = String(part.value || uploadId);
        if (part.fieldname === 'chunkIndex') chunkIndex = parseInt(String(part.value || chunkIndex), 10);
        if (part.fieldname === 'totalChunks') totalChunks = parseInt(String(part.value || totalChunks), 10);
        if (part.fieldname === 'fileName') rawFileName = String(part.value || rawFileName);
        if (part.fieldname === 'fileSize') fileSize = parseInt(String(part.value || fileSize), 10);
        if (part.fieldname === 'bucket') bucket = String(part.value || bucket);
        if (part.fieldname === 'description') description = String(part.value || '');
      } else if (part.type === 'file') {
        fileUploaded = true;
        if (!rawFileName && part.filename) {
          rawFileName = part.filename;
        }
        if (part.mimetype) {
          mimeType = part.mimetype;
        }

        if (!uploadId) {
          uploadId = `single_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }

        chunkResult = await ChunkManager.saveChunk(
          {
            uploadId,
            chunkIndex,
            totalChunks,
            fileName: rawFileName || 'upload.bin',
            fileSize,
          },
          part.file
        );
      }
    }

    if (!fileUploaded) {
      return reply.status(400).send({ success: false, error: 'No file uploaded in request' });
    }

    if (!chunkResult || !chunkResult.isComplete) {
      return reply.status(200).send({
        success: true,
        is_complete: false,
        chunk_index: chunkIndex,
        total_chunks: totalChunks,
        upload_id: uploadId,
      });
    }

    // Assembly complete: move to bucket folder and record in DB
    const cleanBucket = bucket.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'general';
    const originalName = rawFileName || 'upload.bin';
    const cleanName = sanitizeFileName(originalName);
    const storedName = `${Date.now()}_${cleanName}`;

    const targetDir = path.join(config.filesDir, cleanBucket);
    fs.mkdirSync(targetDir, { recursive: true });

    const targetFilePath = path.join(targetDir, storedName);
    const relativeFilePath = path.join('files', cleanBucket, storedName);

    moveFile(chunkResult.mergedFilePath!, targetFilePath);
    ChunkManager.cleanupSession(uploadId);

    const stats = fs.statSync(targetFilePath);
    const hashes = await calculateFileHashes(targetFilePath);

    const uploadedFileRecord = StorageService.saveFile({
      bucket: cleanBucket,
      original_name: originalName,
      stored_name: storedName,
      file_path: relativeFilePath,
      file_size: stats.size,
      mime_type: mimeType,
      sha256: hashes.sha256,
      md5: hashes.md5,
      is_public: true,
      description: description,
    });

    return reply.status(201).send({
      success: true,
      is_complete: true,
      data: uploadedFileRecord,
    });
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
