'use client'

import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALE_COOKIE,
  SiteLocale,
  isSiteLocale,
} from '@/config/site-locale'
import { SiteMessageKey, translate } from './messages'
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'

type SiteI18n = {
  locale: SiteLocale
  setLocale: (locale: SiteLocale) => void
  t: (key: SiteMessageKey, vars?: Record<string, string | number>) => string
}

const SiteI18nContext = createContext<SiteI18n>({
  locale: DEFAULT_SITE_LOCALE,
  setLocale: () => {},
  t: (key, vars) => translate(DEFAULT_SITE_LOCALE, key, vars),
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
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale],
  )

  return <SiteI18nContext.Provider value={value}>{children}</SiteI18nContext.Provider>
}

export const useSiteI18n = () => useContext(SiteI18nContext)
