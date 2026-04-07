import { createHash } from 'crypto';
import { IdempotencyStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export class IdempotencyConflictError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 409) {
    super(message);
    this.name = 'IdempotencyConflictError';
    this.statusCode = statusCode;
  }
}

export interface IdempotentHttpResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface ExecuteIdempotentHttpOptions {
  key?: string | null;
  scope: string;
  actorId?: string | null;
  payload?: unknown;
  ttlMinutes?: number;
  handler: () => Promise<IdempotentHttpResponse>;
}

function toJsonValue(input: unknown): Prisma.InputJsonValue | undefined {
  if (input === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function normalizeKey(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (value.length < 10 || value.length > 128) {
    throw new IdempotencyConflictError('Idempotency key length must be between 10 and 128 characters', 400);
  }
  return value;
}

function hashPayload(payload: unknown): string {
  const source = JSON.stringify(payload ?? null);
  return createHash('sha256').update(source).digest('hex');
}

export async function executeIdempotentHttp(
  options: ExecuteIdempotentHttpOptions
): Promise<{ replayed: boolean; response: IdempotentHttpResponse }> {
  const key = normalizeKey(options.key);
  if (!key) {
    return { replayed: false, response: await options.handler() };
  }

  const requestHash = hashPayload(options.payload);
  const expiresAt = options.ttlMinutes
    ? new Date(Date.now() + options.ttlMinutes * 60 * 1000)
    : null;

  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (existing) {
    if (existing.scope !== options.scope) {
      throw new IdempotencyConflictError('Idempotency key scope mismatch');
    }

    if (existing.actorId && options.actorId && existing.actorId !== options.actorId) {
      throw new IdempotencyConflictError('Idempotency key belongs to another actor');
    }

    if (existing.requestHash && existing.requestHash !== requestHash) {
      throw new IdempotencyConflictError('Idempotency key already used with different payload', 422);
    }

    const expired = Boolean(existing.expiresAt && existing.expiresAt < new Date());
    if (existing.status === 'COMPLETED' && existing.response) {
      return {
        replayed: true,
        response: existing.response as unknown as IdempotentHttpResponse,
      };
    }

    if (existing.status === 'PENDING' && !expired) {
      throw new IdempotencyConflictError('Request with this idempotency key is in progress');
    }
  }

  await prisma.idempotencyKey.upsert({
    where: { key },
    update: {
      scope: options.scope,
      actorId: options.actorId || null,
      requestHash,
      status: IdempotencyStatus.PENDING,
      errorMessage: null,
      expiresAt,
    },
    create: {
      key,
      scope: options.scope,
      actorId: options.actorId || null,
      requestHash,
      status: IdempotencyStatus.PENDING,
      expiresAt,
    },
  });

  try {
    const response = await options.handler();
    await prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: IdempotencyStatus.COMPLETED,
        response: toJsonValue(response),
        errorMessage: null,
      },
    });
    return { replayed: false, response };
  } catch (error) {
    await prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: IdempotencyStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Unknown idempotency error',
      },
    });
    throw error;
  }
}

export function getHeaderIdempotencyKey(headers: Record<string, string | string[] | undefined>): string | null {
  const raw = headers['x-idempotency-key'];
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] || null;
  return raw;
}
