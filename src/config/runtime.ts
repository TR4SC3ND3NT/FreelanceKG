function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

const apiOrigin = withoutTrailingSlash(import.meta.env.VITE_API_ORIGIN || '');
const explicitApiBase = withoutTrailingSlash(import.meta.env.VITE_API_URL || '');

export const API_ORIGIN = apiOrigin || withoutTrailingSlash(explicitApiBase.replace(/\/api\/?$/, '')) || 'http://localhost:3001';
export const API_BASE = explicitApiBase || `${API_ORIGIN}/api`;
export const SOCKET_URL = withoutTrailingSlash(import.meta.env.VITE_SOCKET_URL || '') || API_ORIGIN || 'http://localhost:3001';
