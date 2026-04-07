import fs from 'fs/promises';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { logger } from './logger';

export type UploadType = 'files' | 'avatars';

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function withLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

function joinUrl(base: string, path: string): string {
  return `${withoutTrailingSlash(base)}${withLeadingSlash(path)}`;
}

function toObjectKey(type: UploadType, filename: string): string {
  return `${type}/${filename}`;
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
    },
  });
  return s3Client;
}

export function getUploadsBaseUrl(): string {
  if (env.STORAGE_PROVIDER === 's3') {
    return withoutTrailingSlash(env.S3_PUBLIC_BASE_URL || '');
  }
  return '/uploads';
}

export function getUploadPrefix(type: UploadType): string {
  return joinUrl(getUploadsBaseUrl(), `/${type}/`);
}

export function buildUploadUrl(type: UploadType, filename: string): string {
  return joinUrl(getUploadsBaseUrl(), `/${type}/${filename}`);
}

export function isLocalStorageProvider(): boolean {
  return env.STORAGE_PROVIDER === 'local';
}

export async function publishUploadedFile(params: {
  type: UploadType;
  filename: string;
  localPath: string;
  mimeType?: string;
}): Promise<string> {
  const { type, filename, localPath, mimeType } = params;
  const publicUrl = buildUploadUrl(type, filename);

  if (isLocalStorageProvider()) {
    return publicUrl;
  }

  const key = toObjectKey(type, filename);
  const body = await fs.readFile(localPath);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: mimeType || 'application/octet-stream',
      ACL: 'public-read',
    })
  );

  await fs.unlink(localPath).catch(() => undefined);
  return publicUrl;
}

function extractUploadKey(url: string): string | null {
  if (!url) return null;

  const normalized = url.trim().split('?')[0].split('#')[0];
  if (!normalized) return null;

  const base = getUploadsBaseUrl();
  if (!normalized.startsWith(base)) {
    return null;
  }

  const key = normalized.slice(base.length).replace(/^\/+/, '');
  return key || null;
}

export async function deleteStoredFileByUrl(url: string): Promise<void> {
  const key = extractUploadKey(url);
  if (!key) return;

  if (isLocalStorageProvider()) {
    return;
  }

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    })
  );
}

export async function tryDeleteStoredFileByUrl(url: string): Promise<void> {
  try {
    await deleteStoredFileByUrl(url);
  } catch (error) {
    logger.warn('Failed to delete stored file by url', { url, error });
  }
}
