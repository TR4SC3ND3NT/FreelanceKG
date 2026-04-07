import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import i18n, { languageStorageKey, type Language } from '../i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function isLanguage(value: string | null): value is Language {
  return value === 'ru' || value === 'en' || value === 'ky';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const current = i18n.resolvedLanguage || i18n.language || 'ru';
    return isLanguage(current) ? current : 'ru';
  });

  useEffect(() => {
    const onLanguageChanged = (value: string) => {
      if (isLanguage(value)) {
        setLanguageState(value);
      }
    };

    i18n.on('languageChanged', onLanguageChanged);
    return () => {
      i18n.off('languageChanged', onLanguageChanged);
    };
  }, []);

  const setLanguage = (value: Language) => {
    setLanguageState(value);
    localStorage.setItem(languageStorageKey, value);
    void i18n.changeLanguage(value);
  };

  const value = useMemo<LanguageContextType>(() => {
    const t = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options);

    return {
      language,
      setLanguage,
      t,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
