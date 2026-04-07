import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn';
import type { FaqItem } from '../data/helpFaq';

interface FAQAccordionProps {
  items: FaqItem[];
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <div key={item.question} className="surface overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-[var(--color-text)]"
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <span>{item.question}</span>
              <ChevronDown className={cn('h-5 w-5 shrink-0 text-[var(--color-text-soft)] transition-transform', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
              <div className="border-t border-[var(--color-border)] px-5 py-4">
                <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
