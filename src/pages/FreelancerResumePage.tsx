import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Briefcase, GraduationCap, Languages, MapPin, Save, ShieldCheck } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { FreelancerResumeProfile } from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';

const EMPTY_RESUME: FreelancerResumeProfile = {
  headline: '',
  availability: '',
  experience: '',
  education: '',
  certifications: [],
  languages: [],
  location: '',
  workPreference: '',
  rateNote: '',
};

export function FreelancerResumePage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [resume, setResume] = useState<FreelancerResumeProfile>(EMPTY_RESUME);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadResume = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getFreelancerResumeProfile();
      setResume(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('resume.loadFailed', { defaultValue: 'Failed to load resume' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadResume();
  }, [loadResume]);

  const progress = useMemo(() => {
    const checks = [
      resume.headline.trim().length >= 10,
      resume.location.trim().length > 0,
      resume.availability.trim().length > 0,
      resume.workPreference.trim().length > 0,
      resume.rateNote.trim().length > 0,
      resume.experience.trim().length >= 20,
      resume.education.trim().length >= 8,
      resume.languages.length >= 1,
      resume.certifications.length >= 1,
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [resume]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'FREELANCER') return <Navigate to="/dashboard/client/profile" replace />;

  const saveResume = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setMessage(null);

      const saved = await api.updateFreelancerResumeProfile({
        headline: resume.headline.trim(),
        availability: resume.availability.trim(),
        experience: resume.experience.trim(),
        education: resume.education.trim(),
        certifications: resume.certifications.map((item) => item.trim()).filter(Boolean),
        languages: resume.languages.map((item) => item.trim()).filter(Boolean),
        location: resume.location.trim(),
        workPreference: resume.workPreference.trim(),
        rateNote: resume.rateNote.trim(),
      });

      setResume(saved);
      setMessage(t('resume.saved', { defaultValue: 'Resume saved' }));
      window.setTimeout(() => setMessage(null), 2200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('resume.saveFailed', { defaultValue: 'Failed to save resume' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('dashboard.freelancer.title')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={getFreelancerSidebarItems()}
      onLogout={logout}
    >
      <PageHeader
        title={t('resume.title', { defaultValue: 'Freelancer resume' })}
        subtitle={t('resume.subtitle', {
          defaultValue: 'Fill in your production-ready resume block for clients, payouts and support verification.',
        })}
        badges={
          <>
            <Badge variant="info">{t('resume.completeness', { defaultValue: 'Completeness {{progress}}%', progress })}</Badge>
            <Badge variant="success">{t('resume.liveProfile', { defaultValue: 'Live workspace profile' })}</Badge>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => void saveResume()}
            disabled={isSaving}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t('profile.common.saving', { defaultValue: 'Saving...' }) : t('resume.save', { defaultValue: 'Save resume' })}
          </button>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-success)]">
          {message}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
              <Briefcase className="h-5 w-5" />
              {t('resume.professionalBlock', { defaultValue: 'Professional block' })}
            </h2>
            <div className="space-y-3">
              <input
                value={resume.headline}
                onChange={(event) => setResume((prev) => ({ ...prev, headline: event.target.value }))}
                placeholder={t('resume.headline', { defaultValue: 'Senior React / Node.js developer for product teams' })}
                className={inputClassName()}
                disabled={isLoading}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={resume.availability}
                  onChange={(event) => setResume((prev) => ({ ...prev, availability: event.target.value }))}
                  placeholder={t('resume.availability', { defaultValue: 'Available 30 hrs/week' })}
                  className={inputClassName()}
                  disabled={isLoading}
                />
                <input
                  value={resume.workPreference}
                  onChange={(event) => setResume((prev) => ({ ...prev, workPreference: event.target.value }))}
                  placeholder={t('resume.workPreference', { defaultValue: 'Remote, product support, fixed-price projects' })}
                  className={inputClassName()}
                  disabled={isLoading}
                />
              </div>
              <input
                value={resume.rateNote}
                onChange={(event) => setResume((prev) => ({ ...prev, rateNote: event.target.value }))}
                placeholder={t('resume.rateNote', { defaultValue: 'Typical budget: from 45 000 KGS per sprint' })}
                className={inputClassName()}
                disabled={isLoading}
              />
              <textarea
                value={resume.experience}
                onChange={(event) => setResume((prev) => ({ ...prev, experience: event.target.value }))}
                rows={6}
                placeholder={t('resume.experience', {
                  defaultValue: 'Describe your commercial experience, strongest stack, shipped projects and results.',
                })}
                className={`${inputClassName()} h-auto py-2.5`}
                disabled={isLoading}
              />
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
              <GraduationCap className="h-5 w-5" />
              {t('resume.educationCerts', { defaultValue: 'Education and certificates' })}
            </h2>
            <div className="space-y-3">
              <textarea
                value={resume.education}
                onChange={(event) => setResume((prev) => ({ ...prev, education: event.target.value }))}
                rows={4}
                placeholder={t('resume.education', { defaultValue: 'KSTU, Computer Science, 2018-2022' })}
                className={`${inputClassName()} h-auto py-2.5`}
                disabled={isLoading}
              />
              <textarea
                value={resume.certifications.join('\n')}
                onChange={(event) =>
                  setResume((prev) => ({
                    ...prev,
                    certifications: event.target.value
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                rows={5}
                placeholder={t('resume.certifications', {
                  defaultValue: 'AWS Certified Developer\nMeta Front-End Certificate',
                })}
                className={`${inputClassName()} h-auto py-2.5`}
                disabled={isLoading}
              />
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
              <Languages className="h-5 w-5" />
              {t('resume.languages', { defaultValue: 'Languages' })}
            </h2>
            <textarea
              value={resume.languages.join('\n')}
              onChange={(event) =>
                setResume((prev) => ({
                  ...prev,
                  languages: event.target.value
                    .split('\n')
                    .map((item) => item.trim())
                    .filter(Boolean),
                }))
              }
              rows={5}
              placeholder={t('resume.languagesPlaceholder', { defaultValue: 'Russian\nEnglish\nKyrgyz' })}
              className={`${inputClassName()} h-auto py-2.5`}
              disabled={isLoading}
            />
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-[var(--color-text)]">
              <MapPin className="h-4 w-4" />
              {t('resume.location', { defaultValue: 'Location' })}
            </h3>
            <input
              value={resume.location}
              onChange={(event) => setResume((prev) => ({ ...prev, location: event.target.value }))}
              placeholder={t('resume.locationPlaceholder', { defaultValue: 'Bishkek, Kyrgyzstan' })}
              className={inputClassName()}
              disabled={isLoading}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
              <ShieldCheck className="h-4 w-4" />
              {t('resume.checklistTitle', { defaultValue: 'Presentation checklist' })}
            </p>
            <div className="mt-3 space-y-2">
              {[
                [t('resume.checklist.headline', { defaultValue: 'Headline' }), resume.headline.trim().length >= 10],
                [t('resume.checklist.experience', { defaultValue: 'Experience' }), resume.experience.trim().length >= 20],
                [t('resume.checklist.education', { defaultValue: 'Education' }), resume.education.trim().length >= 8],
                [t('resume.checklist.language', { defaultValue: 'Languages' }), resume.languages.length >= 1],
                [t('resume.checklist.certification', { defaultValue: 'Certificates' }), resume.certifications.length >= 1],
                [t('resume.checklist.location', { defaultValue: 'Location' }), resume.location.trim().length > 0],
                [t('resume.checklist.rate', { defaultValue: 'Rate note' }), resume.rateNote.trim().length > 0],
              ].map(([label, done]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs"
                >
                  <span className="text-[var(--color-text-muted)]">{label}</span>
                  <span className={done ? 'font-semibold text-[var(--color-success)]' : 'font-semibold text-[var(--color-warning)]'}>
                    {done
                      ? t('resume.checklistDone', { defaultValue: 'Done' })
                      : t('resume.checklistPending', { defaultValue: 'Pending' })}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              {t('resume.workspaceLinks', { defaultValue: 'Workspace links' })}
            </h3>
            <div className="space-y-2 text-sm">
              <Link to="/dashboard/freelancer/finance" className="block rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-medium text-[var(--color-text)]">
                {t('sidebar.items.finance', { defaultValue: 'Finance' })}
              </Link>
              <Link to="/dashboard/freelancer/payouts" className="block rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-medium text-[var(--color-text)]">
                {t('resume.goPayouts', { defaultValue: 'Payout methods' })}
              </Link>
              <Link to="/dashboard/freelancer/documents" className="block rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-medium text-[var(--color-text)]">
                {t('sidebar.items.documents', { defaultValue: 'Documents' })}
              </Link>
              <Link to="/dashboard/freelancer/support" className="block rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-medium text-[var(--color-text)]">
                {t('sidebar.items.support', { defaultValue: 'Support' })}
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}

function inputClassName() {
  return 'h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]';
}
