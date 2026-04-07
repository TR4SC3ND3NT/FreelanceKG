import { prisma } from './prisma';

const FEATURE_FLAG_PREFIX = 'feature_flag:';

export const FEATURE_FLAGS = {
  ESCROW_ENABLED: 'escrow.enabled',
  WITHDRAWALS_ENABLED: 'withdrawals.enabled',
  DISPUTES_ENABLED: 'disputes.enabled',
  MILESTONES_ENABLED: 'milestones.enabled',
  CHANGE_REQUESTS_ENABLED: 'change_requests.enabled',
  PROPOSALS_ENABLED: 'proposals.enabled',
  SUPPORT_CASES_ENABLED: 'support_cases.enabled',
  TELEGRAM_ENABLED: 'telegram.enabled',
  RECOMMENDATIONS_ENABLED: 'recommendations.enabled',
  AUDIT_PANEL_ENABLED: 'audit_panel.enabled',
  LEDGER_ENABLED: 'ledger.enabled',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
  [FEATURE_FLAGS.ESCROW_ENABLED]: true,
  [FEATURE_FLAGS.WITHDRAWALS_ENABLED]: true,
  [FEATURE_FLAGS.DISPUTES_ENABLED]: true,
  [FEATURE_FLAGS.MILESTONES_ENABLED]: false,
  [FEATURE_FLAGS.CHANGE_REQUESTS_ENABLED]: false,
  [FEATURE_FLAGS.PROPOSALS_ENABLED]: true,
  [FEATURE_FLAGS.SUPPORT_CASES_ENABLED]: true,
  [FEATURE_FLAGS.TELEGRAM_ENABLED]: true,
  [FEATURE_FLAGS.RECOMMENDATIONS_ENABLED]: false,
  [FEATURE_FLAGS.AUDIT_PANEL_ENABLED]: true,
  [FEATURE_FLAGS.LEDGER_ENABLED]: true,
};

function keyFor(flag: FeatureFlagKey): string {
  return `${FEATURE_FLAG_PREFIX}${flag}`;
}

function parseBool(value: string | null | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return (Object.values(FEATURE_FLAGS) as string[]).includes(value);
}

export async function getFeatureFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: FEATURE_FLAG_PREFIX } },
    select: { key: true, value: true },
  });

  const rowMap = new Map(rows.map((row) => [row.key, row.value]));
  const output = {} as Record<FeatureFlagKey, boolean>;

  for (const flag of Object.values(FEATURE_FLAGS)) {
    output[flag] = parseBool(rowMap.get(keyFor(flag)), DEFAULT_FLAGS[flag]);
  }

  return output;
}

export async function getFeatureFlag(flag: FeatureFlagKey): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: keyFor(flag) },
    select: { value: true },
  });
  return parseBool(row?.value, DEFAULT_FLAGS[flag]);
}

export async function setFeatureFlag(flag: FeatureFlagKey, enabled: boolean, updatedBy?: string): Promise<boolean> {
  await prisma.systemSetting.upsert({
    where: { key: keyFor(flag) },
    update: {
      value: enabled ? 'true' : 'false',
      type: 'boolean',
      updatedBy,
    },
    create: {
      key: keyFor(flag),
      value: enabled ? 'true' : 'false',
      type: 'boolean',
      updatedBy,
    },
  });

  return enabled;
}

export function getDefaultFeatureFlags(): Record<FeatureFlagKey, boolean> {
  return { ...DEFAULT_FLAGS };
}
