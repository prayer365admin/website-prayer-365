'use client'

import { SanctuaryIcon } from '@/components/icon/sanctuary'
import { useSiteI18n } from '@/i18n/site-i18n'
import Image from 'next/image'
import Link from 'next/link'
import s from './footer.module.scss'
import { SUPPORT_HOTLINE, dialHref } from './support-hotline'

export default function SiteFooter({ legalOnly = false }: { legalOnly?: boolean }) {
  const { t } = useSiteI18n()

  const parishLinks = [
    [t('headerHome'), '/'],
    [t('headerDiscoverChurches'), '/churches'],
    [t('headerPrayers'), '/prayers'],
    [t('headerGiving'), '/giving'],
  ] as const

  const policyLinks = [
    [t('footerPrivacyOfConfession'), '/privacy'],
    [t('footerTerms'), '/terms'],
    [t('footerPastoralSupport'), '/support'],
  ] as const

  return (
    <footer className={`${s.footer} ${legalOnly ? s.legalOnly : ''}`}>
      <div className={s.inner}>
        <section aria-label={t('footerIdentity')} className={s.identity}>
          <div className={s.brandLine}>
            <Image alt="" className={s.logo} height={28} src="/images/icon.jpg" width={28} />
            <strong>{t('footerIdentity')}</strong>
            <span>{t('footerPortalLabel')}</span>
          </div>
          <blockquote>{t('footerVerse')}</blockquote>
          <p className={s.reference}>{t('footerVerseReference')}</p>
        </section>

        <nav aria-label={t('footerParishHeading')} className={s.parishNetwork}>
          <h2>{t('footerParishHeading')}</h2>
          {parishLinks.map(([label, href]) => (
            <Link href={href} key={label}>
              {label}
            </Link>
          ))}
        </nav>

        <section className={s.support}>
          <h2>{t('footerSupportHeading')}</h2>
          <div className={s.hotline}>
            <span>{t('footerHotlineLabel')}</span>
            {SUPPORT_HOTLINE.number ? (
              <a href={dialHref(SUPPORT_HOTLINE.number)}>{SUPPORT_HOTLINE.number}</a>
            ) : (
              <Link href="/churches">{t('contactPastoralCare')}</Link>
            )}
            <span>{t('footerHotlineNote')}</span>
          </div>
        </section>

        <div className={s.legal}>
          <p>
            <SanctuaryIcon aria-hidden />
            <span>{t('footerLegal', { year: new Date().getFullYear() })}</span>
          </p>
          <nav aria-label="Legal">
            {policyLinks.map(([label, href]) => (
              <Link href={href} key={label}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
