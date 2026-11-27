import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { i18nResources } from '@shared/i18nResources'

void i18n.use(initReactI18next).init({
  resources: i18nResources,
  lng: 'vi',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
})

export default i18n
