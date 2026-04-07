import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

export type ProfileTab = 'about' | 'portfolio' | 'reviews';

interface ProfileTabsProps {
  activeTab: ProfileTab;
  onTabChange: (value: ProfileTab) => void;
  reviewsCount: number;
}

export function ProfileTabs({ activeTab, onTabChange, reviewsCount }: ProfileTabsProps) {
  const { t } = useTranslation();

  const options = useMemo(
    () => [
      { value: 'about' as const, label: t('freelancerProfile.tabs.about') },
      { value: 'portfolio' as const, label: t('freelancerProfile.tabs.portfolio') },
      { value: 'reviews' as const, label: t('freelancerProfile.tabs.reviews', { count: reviewsCount }) },
    ],
    [reviewsCount, t]
  );

  return (
    <SegmentedControl
      value={activeTab}
      options={options}
      onValueChange={onTabChange}
      className="mb-5"
    />
  );
}
