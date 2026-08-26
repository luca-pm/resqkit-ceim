/**
 * S — Frequently asked questions.
 *
 * Static content, no backend. Content lives in the `faq` i18n namespace
 * (locales/{en,ro}/faq.json) — see Section E2/E8.4 of the RN migration plan.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: React.FC = () => {
  const { t } = useTranslation('faq');
  const items = t('items', { returnObjects: true }) as FaqItem[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" aria-hidden="true" />
          {t('title')}
        </h1>
      </div>
      <Card>
        <CardContent className="p-4">
          <Accordion type="single" collapsible>
            {items.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default FAQ;
