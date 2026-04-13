import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_SUBDIR = 'uploads';

export function getUploadsDir(): string {
  return path.join(process.cwd(), UPLOAD_SUBDIR);
}

export async function ensureUploadsDir(): Promise<void> {
  await mkdir(getUploadsDir(), { recursive: true });
}

/** Extension (lowercase, no dot) -> Content-Type for downloads */
export const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  rtf: 'application/rtf',
};

export const ALLOWED_EXTENSIONS = new Set(Object.keys(EXT_TO_MIME));

const MAX_BYTES = 25 * 1024 * 1024;

export function sanitizeOriginalName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._\- ]+/g, '_').slice(0, 180);
  return base || 'file';
}

export function extFromName(name: string): string {
  const ext = path.extname(name).slice(1).toLowerCase();
  return ext;
}

export function validateUploadFile(name: string, size: number): { ok: true; ext: string } | { ok: false; error: string } {
  if (size > MAX_BYTES) {
    return { ok: false, error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` };
  }
  const ext = extFromName(name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: `Unsupported type .${ext || '?'}. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
    };
  }
  return { ok: true, ext };
}

export async function writeUploadBuffer(originalName: string, buffer: Buffer): Promise<{ storedFileName: string }> {
  const v = validateUploadFile(originalName, buffer.length);
  if (!v.ok) throw new Error(v.error);
  await ensureUploadsDir();
  const safe = sanitizeOriginalName(originalName);
  const storedFileName = `${randomUUID()}_${safe}`;
  const fullPath = path.join(getUploadsDir(), storedFileName);
  await writeFile(fullPath, buffer);
  return { storedFileName };
}

export async function deleteStoredFileIfExists(storedFileName: string | null | undefined): Promise<void> {
  if (!storedFileName) return;
  const fullPath = path.join(getUploadsDir(), storedFileName);
  try {
    await unlink(fullPath);
  } catch {
    /* ignore missing file */
  }
}

export function mimeForStoredFile(originalName: string, reportedMime: string | null | undefined): string {
  const ext = extFromName(originalName);
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  if (reportedMime && reportedMime.length < 200) return reportedMime;
  return 'application/octet-stream';
}
