import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info, UserRoundX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProfileHeader } from '@/pages/FreelancerProfile/components/ProfileHeader';
import { ProfileTabs, type ProfileTab } from '@/pages/FreelancerProfile/components/ProfileTabs';
import { PortfolioGrid } from '@/pages/FreelancerProfile/components/PortfolioGrid';
import { ReviewList } from '@/pages/FreelancerProfile/components/ReviewList';
import { ProfileSidebar } from '@/pages/FreelancerProfile/components/ProfileSidebar';
import { ProfileSkeleton } from '@/pages/FreelancerProfile/components/ProfileSkeleton';
import { useFreelancerProfile } from '@/pages/FreelancerProfile/hooks/useFreelancerProfile';

export function FreelancerProfilePage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<ProfileTab>('about');
  const { freelancer, reviews, portfolio, isLoading, error } = useFreelancerProfile(id);

  if (isLoading) {
    return (
      <PublicLayout containerClassName="max-w-[1280px]">
        <ProfileSkeleton />
      </PublicLayout>
    );
  }

  if (!freelancer) {
    return (
      <PublicLayout containerClassName="max-w-[1280px]">
        <EmptyState
          title={error || t('freelancerProfile.notFound')}
          description={t('freelancerProfile.startHint')}
          icon={<UserRoundX className="h-5 w-5" />}
          action={
            <Link
              to="/freelancers"
              aria-label={t('freelancerProfile.backToList')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-medium text-white transition-[transform,background-color] duration-200 active:scale-[0.98] hover:bg-[var(--color-primary-hover)]"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('freelancerProfile.backToList')}
            </Link>
          }
        />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout containerClassName="max-w-[1320px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/freelancers" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          {t('freelancerProfile.backToList')}
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="success">{t('common.safeDeal')}</Badge>
          <Badge variant="info">{t('common.escrowProtection')}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <ProfileHeader freelancer={freelancer} language={i18n.language} />

          <section className="surface animate-fadeUp-delay p-6">
            <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} reviewsCount={reviews.length} />

            {activeTab === 'about' ? (
              <section>
                <h2 className="section-title">{t('freelancerProfile.aboutTitle')}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {freelancer.bio || t('freelancerProfile.noDescription')}
                </p>

                <h3 className="mt-6 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                  {t('freelancerProfile.skills')}
                </h3>
                {freelancer.skills.length === 0 ? (
                  <EmptyState
                    title={t('freelancerProfile.noSkills', { defaultValue: 'No skills listed yet' })}
                    description={t('freelancerProfile.startHint')}
                    icon={<Info className="h-4 w-4" />}
                    compact
                    className="mt-3"
                  />
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {freelancer.skills.map((skill) => (
                      <Badge key={skill} variant="default">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {activeTab === 'portfolio' ? <PortfolioGrid portfolio={portfolio} /> : null}
            {activeTab === 'reviews' ? <ReviewList reviews={reviews} language={i18n.language} /> : null}
          </section>
        </div>

        <ProfileSidebar freelancerId={freelancer.id} />
      </div>
    </PublicLayout>
  );
}
