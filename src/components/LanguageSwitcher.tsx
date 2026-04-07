import { useLanguage } from '../context/LanguageContext';
import type { Language } from '../i18n';
import { cn } from '../utils/cn';

const languages: Language[] = ['ru', 'en', 'ky'];

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className="inline-flex h-10 items-center rounded-full border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] p-1"
      aria-label={t('language.label')}
    >
      {languages.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLanguage(item)}
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] transition-[background-color,color,transform] duration-200 active:scale-[0.98]',
            language === item
              ? 'bg-[var(--color-primary)] text-white shadow-[0_10px_18px_-14px_color-mix(in_srgb,var(--color-primary)_60%,black)]'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
          )}
        >
          {t(`language.${item}`)}
        </button>
      ))}
    </div>
  );
}
