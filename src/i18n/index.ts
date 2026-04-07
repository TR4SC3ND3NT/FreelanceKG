import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import en from './locales/en.json';
import ky from './locales/ky.json';

export type Language = 'ru' | 'en' | 'ky';

const STORAGE_KEY = 'freelancekg-language';
const SUPPORTED_LANGUAGES: Language[] = ['ru', 'en', 'ky'];

function resolveLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'ru';
  }

  const storedLanguage = localStorage.getItem(STORAGE_KEY);
  if (storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage as Language)) {
    return storedLanguage as Language;
  }

  const browserLanguage = navigator.language.toLowerCase();
  if (browserLanguage.startsWith('en')) return 'en';
  if (browserLanguage.startsWith('ky')) return 'ky';
  return 'ru';
}

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    ky: { translation: ky },
  },
  lng: resolveLanguage(),
  fallbackLng: 'ru',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export const languageStorageKey = STORAGE_KEY;
export default i18n;
