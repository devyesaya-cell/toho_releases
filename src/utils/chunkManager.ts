import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { config } from '../config.js';

export interface ChunkInfo {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  fileSize?: number;
}

export function moveFile(source: string, destination: string) {
  try {
    fs.renameSync(source, destination);
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      fs.copyFileSync(source, destination);
      fs.unlinkSync(source);
    } else {
      throw err;
    }
  }
}

export class ChunkManager {
  private static tempBaseDir = path.join(config.storageDir, 'temp_chunks');

  static init() {
    fs.mkdirSync(this.tempBaseDir, { recursive: true });
    this.cleanOldUploads();
  }

  // Auto clean orphaned sessions older than 24 hours
  static cleanOldUploads() {
    try {
      if (!fs.existsSync(this.tempBaseDir)) return;
      const now = Date.now();
      const entries = fs.readdirSync(this.tempBaseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(this.tempBaseDir, entry.name);
          const stats = fs.statSync(dirPath);
          if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
            fs.rmSync(dirPath, { recursive: true, force: true });
          }
        }
      }
    } catch (e) {
      console.warn('Error cleaning old temp chunk uploads:', e);
    }
  }

  // Save an incoming chunk stream to disk
  static async saveChunk(
    info: ChunkInfo,
    chunkStream: Readable
  ): Promise<{ isComplete: boolean; mergedFilePath?: string }> {
    const { uploadId, chunkIndex, totalChunks } = info;
    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sessionDir = path.join(this.tempBaseDir, safeUploadId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const chunkFilePath = path.join(sessionDir, `chunk_${chunkIndex}.part`);
    await pipeline(chunkStream, fs.createWriteStream(chunkFilePath));

    // Check if all chunks from 0 to totalChunks - 1 are present
    let allReceived = true;
    for (let i = 0; i < totalChunks; i++) {
      const partPath = path.join(sessionDir, `chunk_${i}.part`);
      if (!fs.existsSync(partPath)) {
        allReceived = false;
        break;
      }
    }

    if (!allReceived) {
      return { isComplete: false };
    }

    // If there is only 1 chunk, chunk_0.part is already the complete file
    if (totalChunks === 1) {
      return { isComplete: true, mergedFilePath: chunkFilePath };
    }

    // Merge all chunks into complete.bin
    const mergedFilePath = path.join(sessionDir, 'complete.bin');
    const writeStream = fs.createWriteStream(mergedFilePath, { flags: 'w' });

    for (let i = 0; i < totalChunks; i++) {
      const partPath = path.join(sessionDir, `chunk_${i}.part`);
      if (!fs.existsSync(partPath)) {
        throw new Error(`Missing chunk ${i} during file assembly`);
      }
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(partPath);
        readStream.on('error', reject);
        readStream.on('end', resolve);
        readStream.pipe(writeStream, { end: false });
      });
    }

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return { isComplete: true, mergedFilePath };
  }

  // Clean up session directory after moving the merged file
  static cleanupSession(uploadId: string) {
    try {
      const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const sessionDir = path.join(this.tempBaseDir, safeUploadId);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn(`Failed to cleanup temp chunk session ${uploadId}:`, e);
    }
  }
}
