import { Link } from 'react-router-dom';
import { Facebook, Instagram, Send } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Logo } from './Logo';

export function PublicFooter() {
  const { t } = useLanguage();

  const platformLinks = [
    { to: '/about', label: t('footer.about') },
    { to: '/how-it-works', label: t('footer.howItWorks') },
    { to: '/categories', label: t('footer.categories') },
    { to: '/blog', label: t('footer.blog') },
  ];

  const supportLinks = [
    { to: '/help', label: t('footer.help') },
    { to: '/faq', label: t('footer.faq') },
    { to: '/contact', label: t('footer.contact') },
    { to: '/terms', label: t('footer.terms') },
  ];

  return (
    <footer className="relative border-t border-[color-mix(in_srgb,var(--color-border)_66%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_90%,var(--color-bg)_10%)] px-4 pb-10 pt-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--color-primary)_35%,transparent),transparent)]" />
      <div className="mx-auto max-w-[var(--layout-public-width)]">
        <div className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo size="md" className="mb-4" />
            <p className="max-w-md text-sm leading-relaxed text-[var(--color-text-muted)]">{t('footer.description')}</p>
            <div className="mt-5 flex gap-2">
              {[
                { href: 'https://instagram.com', icon: Instagram, label: 'Instagram' },
                { href: 'https://t.me', icon: Send, label: 'Telegram' },
                { href: 'https://facebook.com', icon: Facebook, label: 'Facebook' },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">{t('footer.platform')}</h4>
            <ul className="mt-4 space-y-2.5">
              {platformLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">{t('footer.support')}</h4>
            <ul className="mt-4 space-y-2.5">
              {supportLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[var(--color-surface-2)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('common.safeDeal')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                {t('landing.escrowSubtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-[color-mix(in_srgb,var(--color-border)_62%,transparent)] pt-6 text-center text-sm text-[var(--color-text-soft)]">
          {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
}
