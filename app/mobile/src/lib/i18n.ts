/**
 * i18n infra (Section E2/E6) — RN port of app/frontend/src/lib/i18n.ts, same
 * namespace/resource shape, kept byte-identical in structure so the two
 * locale trees can be collapsed into one shared copy once app/shared exists.
 * fallbackLng is 'en' to match the web app's default.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import commonEn from '@/locales/en/common.json';
import authEn from '@/locales/en/auth.json';
import accountEn from '@/locales/en/account.json';
import settingsEn from '@/locales/en/settings.json';
import faqEn from '@/locales/en/faq.json';
import contactEn from '@/locales/en/contact.json';
import historyEn from '@/locales/en/history.json';
import chatEn from '@/locales/en/chat.json';
import tutorialsEn from '@/locales/en/tutorials.json';

import commonRo from '@/locales/ro/common.json';
import authRo from '@/locales/ro/auth.json';
import accountRo from '@/locales/ro/account.json';
import settingsRo from '@/locales/ro/settings.json';
import faqRo from '@/locales/ro/faq.json';
import contactRo from '@/locales/ro/contact.json';
import historyRo from '@/locales/ro/history.json';
import chatRo from '@/locales/ro/chat.json';
import tutorialsRo from '@/locales/ro/tutorials.json';

const deviceLanguage = Localization.getLocales()[0]?.languageCode === 'ro' ? 'ro' : 'en';

void i18n
  .use(initReactI18next)
  .init({
    lng: deviceLanguage,
    fallbackLng: 'en',
    supportedLngs: ['en', 'ro'],
    resources: {
      en: {
        common: commonEn, auth: authEn, account: accountEn, settings: settingsEn,
        faq: faqEn, contact: contactEn, history: historyEn, chat: chatEn, tutorials: tutorialsEn,
      },
      ro: {
        common: commonRo, auth: authRo, account: accountRo, settings: settingsRo,
        faq: faqRo, contact: contactRo, history: historyRo, chat: chatRo, tutorials: tutorialsRo,
      },
    },
    ns: ['common', 'auth', 'account', 'settings', 'faq', 'contact', 'history', 'chat', 'tutorials'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });

/** Called from SettingsContext so an explicit user choice always wins over the device locale. */
export function applyUiLanguage(lang: 'en' | 'ro' | null): void {
  if (lang) {
    void i18n.changeLanguage(lang);
  }
}

export default i18n;
