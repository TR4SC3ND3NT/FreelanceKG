import { useState } from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import { PublicPageLayout } from '../components/PublicPageLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useTranslation } from 'react-i18next';

export function ContactPage() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSent(true);
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <PublicPageLayout title={t('contactPage.title')} subtitle={t('contactPage.subtitle')}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          {[
            { icon: Mail, title: 'Email', value: 'support@freelancekg.kg' },
            { icon: Phone, title: t('contactPage.phone'), value: '+996 (555) 12-34-56' },
            { icon: MapPin, title: t('contactPage.address'), value: t('contactPage.addressValue') },
          ].map((item) => (
            <Card key={item.title} className="p-5">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-primary)]">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">{item.title}</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">{item.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="surface p-6 lg:col-span-3">
          {sent && (
            <div className="mb-4 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-success)]">
              {t('contactPage.sent')}
            </div>
          )}

          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              label={t('auth.name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">{t('contactPage.message')}</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                rows={6}
                className="w-full resize-none rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_32%,transparent)]"
              />
            </label>

            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              {t('contactPage.send')}
            </button>
          </form>
        </div>
      </div>
    </PublicPageLayout>
  );
}
