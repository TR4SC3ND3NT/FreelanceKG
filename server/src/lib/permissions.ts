import type { Role } from '@prisma/client';

export const PERMISSIONS = [
  'orders.read',
  'orders.write',
  'orders.manage',
  'proposals.read',
  'proposals.write',
  'milestones.manage',
  'change_requests.manage',
  'messages.read',
  'messages.write',
  'disputes.read',
  'disputes.write',
  'disputes.resolve',
  'finance.read',
  'ledger.read',
  'finance.withdraw.request',
  'finance.withdraw.approve',
  'users.read',
  'users.manage',
  'users.ban',
  'cases.read',
  'cases.manage',
  'audit.read',
  'settings.read',
  'settings.manage',
  'feature_flags.read',
  'feature_flags.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSION_MAP: Record<Role, Permission[]> = {
  CLIENT: [
    'orders.read',
    'orders.write',
    'proposals.read',
    'messages.read',
    'messages.write',
    'disputes.read',
    'disputes.write',
    'finance.read',
    'settings.read',
  ],
  FREELANCER: [
    'orders.read',
    'orders.write',
    'proposals.read',
    'proposals.write',
    'milestones.manage',
    'change_requests.manage',
    'messages.read',
    'messages.write',
    'disputes.read',
    'disputes.write',
    'finance.read',
    'finance.withdraw.request',
    'settings.read',
  ],
  ADMIN: [...PERMISSIONS],
};

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSION_MAP[role] || [];
}

export function hasPermissionList(
  permissions: readonly string[] | undefined | null,
  permission: Permission
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(permission);
}

export function ensurePermissions(role: Role, permissions?: readonly string[] | null): Permission[] {
  if (permissions && permissions.length > 0) {
    return permissions.filter((item): item is Permission =>
      (PERMISSIONS as readonly string[]).includes(item)
    );
  }
  return getPermissionsForRole(role);
}
