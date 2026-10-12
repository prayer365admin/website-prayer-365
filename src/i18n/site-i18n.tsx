'use client'

import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALE_COOKIE,
  SiteLocale,
  isSiteLocale,
} from '@/config/site-locale'
import { SITE_MESSAGES, SiteMessageKey } from './messages'
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'

type SiteI18n = {
  locale: SiteLocale
  setLocale: (locale: SiteLocale) => void
  t: (key: SiteMessageKey) => string
}

const SiteI18nContext = createContext<SiteI18n>({
  locale: DEFAULT_SITE_LOCALE,
  setLocale: () => {},
  t: (key) => SITE_MESSAGES[DEFAULT_SITE_LOCALE][key] ?? key,
})

export function SiteI18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode
  initialLocale: SiteLocale
}) {
  const [locale, setLocaleState] = useState<SiteLocale>(initialLocale)

  const setLocale = useCallback((next: SiteLocale) => {
    if (!isSiteLocale(next)) return
    document.cookie = `${SITE_LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`
    setLocaleState(next)
  }, [])

  const value = useMemo<SiteI18n>(
    () => ({
      locale,
      setLocale,
      t: (key) => SITE_MESSAGES[locale][key] ?? key,
    }),
    [locale, setLocale],
  )

  return <SiteI18nContext.Provider value={value}>{children}</SiteI18nContext.Provider>
}

export const useSiteI18n = () => useContext(SiteI18nContext)
