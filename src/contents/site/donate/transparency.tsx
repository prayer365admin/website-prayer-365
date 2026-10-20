'use client'

import { useSiteI18n } from '@/i18n/site-i18n'
import { ShieldCheckIcon } from '@/components/icon/shield-check'

/** W11 footnote: the audit promise plus the two public ledgers. */
export function DonateTransparency() {
  const { t } = useSiteI18n()

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-[#F2F4F6] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <ShieldCheckIcon style={{ fontSize: 22, color: '#2F7AD2' }} className="shrink-0" />
        <div>
          <h2 className="text-base font-semibold leading-5 text-[#191C1E]">
            {t('donateTransparencyTitle')}
          </h2>
          <p className="text-xs font-medium leading-4 text-[#414752]">
            {t('donateTransparencyBody')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs font-semibold leading-4 text-[#16629B]">
        <a className="underline-offset-2 hover:underline" href="#">
          {t('donateAuditLink')}
        </a>
        <span aria-hidden="true">•</span>
        <a className="underline-offset-2 hover:underline" href="#">
          {t('donateRegistryLink')}
        </a>
      </div>
    </section>
  )
}
