import type { Language } from '@/i18n';

const localeByLanguage: Record<Language, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  ky: 'ky-KG',
};

export function resolveLocale(language: string | undefined): string {
  if (language === 'en') return localeByLanguage.en;
  if (language === 'ky') return localeByLanguage.ky;
  return localeByLanguage.ru;
}

export function formatMoneyKGS(value: number, language: string | undefined): string {
  return new Intl.NumberFormat(resolveLocale(language), {
    style: 'currency',
    currency: 'KGS',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(
  value: string | number | Date,
  language: string | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(resolveLocale(language), options).format(date);
}

export function formatDateTime(
  value: string | number | Date,
  language: string | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(resolveLocale(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date);
}
