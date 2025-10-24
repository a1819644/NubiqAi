import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

type SaveResult = {
  id: string;
  fileName: string;
  filePath: string;
  localUri: string; // public URI served by express, e.g. /local-images/<fileName>
};

class LocalImageCacheService {
  private enabled: boolean;
  private baseDir: string;
  private ttlMs: number;
  private maxFiles: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    const envEnabled = process.env.LOCAL_IMAGE_CACHE_ENABLED;
    const isDev = (process.env.NODE_ENV || '').toLowerCase() !== 'production';
    this.enabled = envEnabled ? envEnabled.toLowerCase() === 'true' : isDev; // default ON for dev

    const defaultDir = path.resolve(__dirname, '..', 'local-images');
    this.baseDir = process.env.LOCAL_IMAGE_CACHE_DIR || defaultDir;

    // default TTL 60 minutes
    const ttlMin = Number(process.env.LOCAL_IMAGE_CACHE_TTL_MINUTES || 60);
    this.ttlMs = Math.max(1, ttlMin) * 60 * 1000;

    // default max files 500
    this.maxFiles = Number(process.env.LOCAL_IMAGE_CACHE_MAX_FILES || 500);

    if (this.enabled) {
      this.ensureDir();
      this.startCleanup();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  getBaseDir() {
    return this.baseDir;
  }

  getPublicUri(fileName: string): string {
    const base = process.env.LOCAL_IMAGE_BASE_URL || 'http://localhost:8000';
    return `${base.replace(/\/$/, '')}/local-images/${encodeURIComponent(fileName)}`;
  }

  private ensureDir() {
    try {
      fs.mkdirSync(this.baseDir, { recursive: true });
    } catch (e) {
      // noop
    }
  }

  private startCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired().catch((e) => console.warn('LocalImageCache cleanup failed:', e));
    }, Math.min(this.ttlMs, 10 * 60 * 1000)); // run at least every 10 minutes or TTL, whichever is smaller
    // Do one pass at startup
    this.cleanupExpired().catch(() => {});
  }

  private async cleanupExpired() {
    try {
      const files = fs.readdirSync(this.baseDir)
        .map((name) => ({ name, full: path.join(this.baseDir, name) }))
        .filter((f) => {
          try { return fs.statSync(f.full).isFile(); } catch { return false; }
        });

      const now = Date.now();
      // Remove by TTL
      for (const f of files) {
        try {
          const st = fs.statSync(f.full);
          if (now - st.mtimeMs > this.ttlMs) {
            fs.unlinkSync(f.full);
          }
        } catch {}
      }

      // Enforce max files (LRU by mtime)
      const filesAfter = fs.readdirSync(this.baseDir)
        .map((name) => ({ name, full: path.join(this.baseDir, name) }))
        .filter((f) => {
          try { return fs.statSync(f.full).isFile(); } catch { return false; }
        })
        .map((f) => {
          const st = fs.statSync(f.full);
          return { ...f, mtime: st.mtimeMs };
        })
        .sort((a, b) => a.mtime - b.mtime); // oldest first

      while (filesAfter.length > this.maxFiles) {
        const victim = filesAfter.shift();
        if (victim) {
          try { fs.unlinkSync(victim.full); } catch {}
        }
      }
    } catch (e) {
      // ignore
    }
  }

  async saveBase64(userId: string, chatId: string, imageBase64: string, ext: string = 'png'): Promise<SaveResult> {
    if (!this.enabled) throw new Error('Local image cache disabled');
    this.ensureDir();
    const id = uuidv4();
    const safeUser = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeChat = (chatId || 'chat').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `${Date.now()}_${safeUser}_${safeChat}_${id}.${ext}`;
    const filePath = path.join(this.baseDir, fileName);

    // strip possible data: prefix
    const b64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const buffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { id, fileName, filePath, localUri: this.getPublicUri(fileName) };
  }

  async saveFromUri(userId: string, chatId: string, uri: string, ext: string = 'png'): Promise<SaveResult> {
    if (!this.enabled) throw new Error('Local image cache disabled');
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    this.ensureDir();
    const id = uuidv4();
    const safeUser = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeChat = (chatId || 'chat').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `${Date.now()}_${safeUser}_${safeChat}_${id}.${ext}`;
    const filePath = path.join(this.baseDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return { id, fileName, filePath, localUri: this.getPublicUri(fileName) };
  }
}

export const localImageCacheService = new LocalImageCacheService();
export default localImageCacheService;
