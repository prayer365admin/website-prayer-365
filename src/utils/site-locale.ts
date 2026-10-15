import {
  DEFAULT_SITE_LOCALE,
  isSiteLocale,
  SITE_LOCALE_COOKIE,
  SiteLocale,
} from '@/config/site-locale'
import { cookies } from 'next/headers'

/** Server-side UI language for website pages: the language cookie, else English. */
export async function getSiteLocale(): Promise<SiteLocale> {
  const value = (await cookies()).get(SITE_LOCALE_COOKIE)?.value
  return isSiteLocale(value) ? value : DEFAULT_SITE_LOCALE
}
