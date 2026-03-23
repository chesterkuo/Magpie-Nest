import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh-CN.json'
import fr from './locales/fr.json'
import es from './locales/es.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import th from './locales/th.json'
import nl from './locales/nl.json'
import id from './locales/id.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-TW': { translation: zhTW },
      'zh-CN': { translation: zhCN },
      fr: { translation: fr },
      es: { translation: es },
      ja: { translation: ja },
      ko: { translation: ko },
      th: { translation: th },
      nl: { translation: nl },
      id: { translation: id },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'magpie-lang',
    },
  })

export default i18n
