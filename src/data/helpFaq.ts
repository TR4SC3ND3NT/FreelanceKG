import type { TFunction } from 'i18next';

export interface FaqItem {
  question: string;
  answer: string;
}

export function getFaqItems(t: TFunction): FaqItem[] {
  return [
    {
      question: t('faq.items.escrow.question'),
      answer: t('faq.items.escrow.answer'),
    },
    {
      question: t('faq.items.select.question'),
      answer: t('faq.items.select.answer'),
    },
    {
      question: t('faq.items.quality.question'),
      answer: t('faq.items.quality.answer'),
    },
    {
      question: t('faq.items.fees.question'),
      answer: t('faq.items.fees.answer'),
    },
    {
      question: t('faq.items.remote.question'),
      answer: t('faq.items.remote.answer'),
    },
    {
      question: t('faq.items.support.question'),
      answer: t('faq.items.support.answer'),
    },
  ];
}
