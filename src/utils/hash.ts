import crypto from 'node:crypto';
import fs from 'node:fs';

export interface FileHashes {
  sha256: string;
  md5: string;
}

/**
 * Calculates SHA-256 and MD5 checksums of a file on disk via streams
 * for maximum performance and minimal RAM consumption.
 */
export async function calculateFileHashes(filePath: string): Promise<FileHashes> {
  return new Promise((resolve, reject) => {
    const sha256Hash = crypto.createHash('sha256');
    const md5Hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      sha256Hash.update(chunk);
      md5Hash.update(chunk);
    });

    stream.on('end', () => {
      resolve({
        sha256: sha256Hash.digest('hex'),
        md5: md5Hash.digest('hex'),
      });
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Clean and sanitize file name to prevent directory traversal or invalid characters.
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Format bytes into human-readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
