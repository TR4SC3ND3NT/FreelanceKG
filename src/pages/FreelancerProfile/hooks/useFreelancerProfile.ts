import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import api, { type Freelancer, type Review } from '@/services/api';
import { getErrorMessage } from '@/utils/errorMessage';

export interface PortfolioItem {
  id?: string | number;
  title?: string;
  description?: string;
  imageUrl?: string;
  image?: string;
}

function normalizePortfolio(value: unknown): PortfolioItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is PortfolioItem => typeof item === 'object' && item !== null);
}

interface UseFreelancerProfileResult {
  freelancer: Freelancer | null;
  reviews: Review[];
  portfolio: PortfolioItem[];
  isLoading: boolean;
  error: string | null;
}

export function useFreelancerProfile(id?: string): UseFreelancerProfileResult {
  const { t } = useTranslation();
  const [freelancer, setFreelancer] = useState<Freelancer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!id) {
      setFreelancer(null);
      setError(t('freelancerProfile.notFound'));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const profile = await api.getFreelancer(id);
      setFreelancer(profile);
    } catch (err) {
      const message = getErrorMessage(err, t('freelancerProfile.loadFailed'));
      setFreelancer(null);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const reviews = useMemo(() => freelancer?.reviews || [], [freelancer?.reviews]);
  const portfolio = useMemo(() => normalizePortfolio(freelancer?.portfolio), [freelancer?.portfolio]);

  return {
    freelancer,
    reviews,
    portfolio,
    isLoading,
    error,
  };
}
