import { StarsIcon } from '@/components/icon/stars'
import { SiteT } from '@/i18n/messages'
import { AuthCardSection } from './auth-card'
import Pill from './pill'
import ScriptureQuote from './scripture-quote'

/*
 * Top of the sign-in style card (W01 design): portal pill + session label,
 * title, subtitle, scripture quote. Shared by sign-in, forgot and reset
 * password, which only change the title and subtitle.
 */
export default function SanctuaryHeader({
  t,
  title,
  subtitle,
}: {
  t: SiteT
  title: string
  subtitle: string
}) {
  return (
    <>
      <AuthCardSection>
        <div className="flex items-center justify-between gap-2">
          <Pill icon={<StarsIcon aria-hidden />}>{t('signInPortal')}</Pill>
          <span className="text-sm text-blue-800">{t('signInSession')}</span>
        </div>
        <h1 className="mt-4 font-font_heading text-2xl font-bold tracking-tight text-primary-900 md:text-[32px]">
          {title}
        </h1>
        <p className="mt-2 text-neutral-600">{subtitle}</p>
      </AuthCardSection>
      <AuthCardSection className="md:pt-0">
        <ScriptureQuote quote={t('signInQuote')} reference={t('signInQuoteRef')} />
      </AuthCardSection>
    </>
  )
}
