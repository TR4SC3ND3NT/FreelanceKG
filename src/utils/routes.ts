import type { User } from '@/services/api';

export const WORKSPACE_PATH = '/workspace';

type UserRole = User['role'] | null | undefined;

export function getRoleHomePath(role: UserRole): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'FREELANCER') return '/dashboard/freelancer/overview';
  return '/dashboard/client/overview';
}
