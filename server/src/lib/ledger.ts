import { randomUUID } from 'crypto';
import { LedgerAccount, LedgerDirection, Prisma } from '@prisma/client';
import { prisma } from './prisma';

type LedgerDbClient = Prisma.TransactionClient | typeof prisma;

export interface LedgerLine {
  account: LedgerAccount;
  direction: LedgerDirection;
  amount: Prisma.Decimal | number | string;
  userId?: string | null;
  orderId?: string | null;
  currency?: string;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface LedgerBatchInput {
  batchId?: string;
  entries: LedgerLine[];
}

function toDecimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

function sumEntries(entries: LedgerLine[], direction: LedgerDirection): Prisma.Decimal {
  return entries
    .filter((entry) => entry.direction === direction)
    .reduce((acc, entry) => acc.plus(toDecimal(entry.amount)), new Prisma.Decimal(0));
}

export function createLedgerBatchId(prefix = 'LGR'): string {
  return `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export async function postLedgerBatch(db: LedgerDbClient, input: LedgerBatchInput): Promise<string> {
  if (!input.entries.length) {
    throw new Error('Ledger batch must contain at least one entry');
  }

  for (const entry of input.entries) {
    if (!entry.referenceType || !entry.referenceId) {
      throw new Error('Ledger entry requires referenceType and referenceId');
    }
  }

  const totalDebit = sumEntries(input.entries, 'DEBIT');
  const totalCredit = sumEntries(input.entries, 'CREDIT');
  if (!totalDebit.equals(totalCredit)) {
    throw new Error(`Ledger batch is unbalanced: debit=${totalDebit.toString()} credit=${totalCredit.toString()}`);
  }

  const batchId = input.batchId || createLedgerBatchId();

  for (const entry of input.entries) {
    await db.ledgerEntry.create({
      data: {
        batchId,
        userId: entry.userId || null,
        orderId: entry.orderId || null,
        account: entry.account,
        direction: entry.direction,
        amount: toDecimal(entry.amount),
        currency: entry.currency || 'KGS',
        referenceType: entry.referenceType || null,
        referenceId: entry.referenceId || null,
        description: entry.description || null,
        metadata: entry.metadata,
      },
    });
  }

  return batchId;
}
