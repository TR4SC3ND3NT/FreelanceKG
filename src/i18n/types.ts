export interface I18nMessages {
  language: {
    label: string;
    ru: string;
    en: string;
    ky: string;
  };
  navbar: {
    freelancers: string;
    howItWorks: string;
    categories: string;
    login: string;
    register: string;
    profile: string;
    dashboard: string;
    logout: string;
  };
  footer: {
    description: string;
    platform: string;
    support: string;
    about: string;
    howItWorks: string;
    categories: string;
    blog: string;
    help: string;
    faq: string;
    contact: string;
    terms: string;
    copyright: string;
  };
  landing: {
    heroTitleStart: string;
    heroTitleHighlight: string;
    heroTitleEnd: string;
    heroSubtitle: string;
    ctaFindFreelancer: string;
    ctaBecomeFreelancer: string;
    statsFreelancers: string;
    statsOrders: string;
    statsSatisfaction: string;
    howTitle: string;
    howSubtitle: string;
    step1Title: string;
    step1Description: string;
    step2Title: string;
    step2Description: string;
    step3Title: string;
    step3Description: string;
    categoriesTitle: string;
    categoriesSubtitle: string;
    categoryFreelancersSuffix: string;
    whyTitle: string;
    featureSafeTitle: string;
    featureSafeDescription: string;
    featureVerifiedTitle: string;
    featureVerifiedDescription: string;
    featureSupportTitle: string;
    featureSupportDescription: string;
    featurePriceTitle: string;
    featurePriceDescription: string;
    ctaTitle: string;
    ctaSubtitle: string;
    ctaButton: string;
    categoryNames: {
      development: string;
      design: string;
      marketing: string;
      copywriting: string;
      video: string;
      translation: string;
    };
  };
  auth: {
    loginWithGoogle: string;
    loginWithGithub: string;
  };
}

export type Language = 'ru' | 'en' | 'ky';
