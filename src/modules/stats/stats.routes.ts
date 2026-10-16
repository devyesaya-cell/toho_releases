import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { optionalAuth } from '../auth/auth.js';
import { formatBytes } from '../../utils/hash.js';

export async function statsRoutes(fastify: FastifyInstance) {
  fastify.get('/stats', { preHandler: optionalAuth }, async (req, reply) => {
    const db = getDb();

    const appCount = (db.prepare('SELECT COUNT(*) as count FROM apps').get() as { count: number }).count;
    const releaseCount = (db.prepare('SELECT COUNT(*) as count FROM releases').get() as { count: number }).count;
    
    const assetStats = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size, COALESCE(SUM(download_count), 0) as total_downloads FROM release_assets').get() as { count: number; total_size: number; total_downloads: number };
    
    const fileStats = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size, COALESCE(SUM(download_count), 0) as total_downloads FROM storage_files').get() as { count: number; total_size: number; total_downloads: number };

    const totalSizeBytes = assetStats.total_size + fileStats.total_size;
    const totalDownloads = assetStats.total_downloads + fileStats.total_downloads;

    return {
      success: true,
      data: {
        total_apps: appCount,
        total_releases: releaseCount,
        total_release_assets: assetStats.count,
        total_storage_files: fileStats.count,
        total_files: assetStats.count + fileStats.count,
        total_downloads: totalDownloads,
        total_storage_bytes: totalSizeBytes,
        total_storage_formatted: formatBytes(totalSizeBytes),
        node_version: process.version,
        uptime_seconds: Math.floor(process.uptime()),
      },
    };
  });
}
