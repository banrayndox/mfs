import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import bn from './locales/bn.json';

const savedLang = typeof window !== 'undefined' ? localStorage.getItem('guardian_lang') || 'bn' : 'bn';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      bn: { translation: bn },
    },
    lng: savedLang,
    fallbackLng: 'bn',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
