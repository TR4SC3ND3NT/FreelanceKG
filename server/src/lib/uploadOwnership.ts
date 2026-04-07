import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { buildUploadUrl, getUploadPrefix, isLocalStorageProvider } from './storage';

const FILES_URL_PREFIX = getUploadPrefix('files');
const SIGNATURE_LENGTH = 24;
const UPLOAD_FILENAME_RE = /^[a-z0-9._-]+$/i;

function signPayload(userId: string, payload: string): string {
  return crypto
    .createHmac('sha256', env.SESSION_SECRET)
    .update(`${userId}:${payload}`)
    .digest('hex')
    .slice(0, SIGNATURE_LENGTH);
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function createOwnedUploadFilename(userId: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const safeExt = ext && ext.length <= 12 ? ext : '';
  const payload = `${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
  const signature = signPayload(userId, payload);
  return `${payload}_${signature}${safeExt}`;
}

export function toOwnedUploadUrl(filename: string): string {
  return buildUploadUrl('files', filename);
}

export function extractOwnedUploadFilename(fileUrl: string): string | null {
  const normalized = fileUrl.trim().split('?')[0].split('#')[0];

  if (!normalized.startsWith(FILES_URL_PREFIX)) {
    return null;
  }

  const rawFilename = normalized.slice(FILES_URL_PREFIX.length);
  if (!rawFilename) {
    return null;
  }

  const filename = path.basename(rawFilename);
  if (filename !== rawFilename || !UPLOAD_FILENAME_RE.test(filename)) {
    return null;
  }

  return filename;
}

export function isOwnedUploadFilename(filename: string, userId: string): boolean {
  const basename = path.basename(filename);
  const nameWithoutExt = basename.includes('.') ? basename.slice(0, basename.lastIndexOf('.')) : basename;
  const parts = nameWithoutExt.split('_');

  if (parts.length < 3) {
    return false;
  }

  const signature = parts.pop();
  if (!signature) {
    return false;
  }

  const payload = parts.join('_');
  const expected = signPayload(userId, payload);
  return safeCompare(signature, expected);
}

export function validateOwnedUploadForUser(
  fileUrl: string | undefined,
  userId: string,
  uploadsDir: string
): { ok: true; normalizedUrl?: string } | { ok: false; status: number; error: string } {
  if (!fileUrl) {
    return { ok: true };
  }

  const filename = extractOwnedUploadFilename(fileUrl);
  if (!filename) {
    return { ok: false, status: 400, error: 'Некорректный URL файла' };
  }

  if (!isOwnedUploadFilename(filename, userId)) {
    return { ok: false, status: 403, error: 'Нельзя прикреплять или удалять чужой файл' };
  }

  if (isLocalStorageProvider()) {
    const filePath = path.join(uploadsDir, 'files', filename);
    if (!fs.existsSync(filePath)) {
      return { ok: false, status: 400, error: 'Файл не найден. Загрузите файл заново.' };
    }
  }

  return { ok: true, normalizedUrl: toOwnedUploadUrl(filename) };
}
