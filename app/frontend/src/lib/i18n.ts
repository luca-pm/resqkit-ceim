/**
 * i18n infra (Section E2). Scope: the new marketing-driven screens only —
 * existing screens (Emergency wizard, Handoff, Review, etc.) are not
 * retrofitted here, that's separate future work.
 *
 * fallbackLng is 'en' to match the existing all-English codebase, even
 * though the marketing screens themselves were handed off in Romanian.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import commonEn from '@/locales/en/common.json';
import faqEn from '@/locales/en/faq.json';
import contactEn from '@/locales/en/contact.json';
import tutorialsEn from '@/locales/en/tutorials.json';

import commonRo from '@/locales/ro/common.json';
import faqRo from '@/locales/ro/faq.json';
import contactRo from '@/locales/ro/contact.json';
import tutorialsRo from '@/locales/ro/tutorials.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'ro'],
    resources: {
      en: { common: commonEn, faq: faqEn, contact: contactEn, tutorials: tutorialsEn },
      ro: { common: commonRo, faq: faqRo, contact: contactRo, tutorials: tutorialsRo },
    },
    ns: ['common', 'faq', 'contact', 'tutorials'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      // AppSettings.uiLanguage (applyUiLanguage below) takes precedence when
      // set; this detector only supplies the initial/fallback value.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'resqkit.uiLanguage.v1',
      caches: ['localStorage'],
    },
  });

/** Called from AppSettings load/update so an explicit user choice always wins. */
export function applyUiLanguage(lang: 'en' | 'ro' | null): void {
  if (lang) {
    void i18n.changeLanguage(lang);
  }
}

export default i18n;
