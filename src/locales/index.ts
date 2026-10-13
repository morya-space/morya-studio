import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import enUS from './en-US'

export type AppLocale = 'zh-CN' | 'en-US'

const STORAGE_KEY = 'morya-studio-locale'

export const supportedLocales: Array<{ value: AppLocale; label: string }> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
]

function detectInitialLocale(): AppLocale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh-CN' || saved === 'en-US') return saved
  } catch {
    /* ignore */
  }
  return 'zh-CN'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute('lang', locale)
}
