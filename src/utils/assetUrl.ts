import { API_BASE } from '@/config/runtime';

const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export function toAbsoluteAssetUrl(url?: string | null): string | undefined {
  if (!url) {
    return undefined;
  }

  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) {
    return url;
  }

  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
