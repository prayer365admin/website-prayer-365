'use client'

import MaskIcon from '@/components/site/mask-icon'
import { useSiteI18n } from '@/i18n/site-i18n'
import { SitePrayerDetail } from '@/models/site-prayer'
import { ArrowRightOutlined, PhoneOutlined } from '@ant-design/icons'
import Image from 'next/image'
import Link from 'next/link'

const card = 'rounded-2xl bg-white shadow-[0_8px_30px_rgba(24,74,140,0.08)]'
const softButton =
  'flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary-150 text-sm font-medium text-blue-800 transition hover:bg-primary-300/40'

/** W10 right rail: pastor and crisis support. */
export function PrayerDetailSidebar({ detail }: { detail: SitePrayerDetail }) {
  const { t } = useSiteI18n()
  const { prayer, church, related } = detail
  const phoneHref = church.phone?.replace(/[^\d+]/g, '')

  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <section className={card}>
        <h2 className="border-b border-neutral-200 p-4 text-xl font-semibold text-primary-900">
          {t('prayerDetailLeadership')}
        </h2>
        <div className="p-4">
          <div className="flex items-start gap-3">
            {prayer.pastorImageUrl ? (
              <Image
                alt=""
                className="size-12 shrink-0 rounded-full object-cover"
                height={48}
                src={prayer.pastorImageUrl}
                width={48}
              />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-500 font-semibold text-white">
                {prayer.pastorName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-semibold text-primary-900">
                <span className="truncate">{prayer.pastorName}</span>
                <MaskIcon className="bg-primary-500" size={14} src="/icons/icon-verified.svg" />
              </p>
              <p className="text-xs text-primary-500">
                {[prayer.pastorRole, church.name].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>
          {prayer.pastorBio && (
            <p className="mt-4 line-clamp-5 text-sm leading-6 text-neutral-600">
              {prayer.pastorBio}
            </p>
          )}
          <Link className={`mt-4 ${softButton}`} href={`/churches/${church.id}`}>
            {t('prayerDetailViewChurch', {
              church: church.city ? `${church.name} (${church.city})` : church.name,
            })}
            <ArrowRightOutlined />
          </Link>
        </div>
      </section>

      {related.length > 0 && (
        <section className={card}>
          <h2 className="border-b border-neutral-200 p-4 text-xl font-semibold text-primary-900">
            {t('prayerDetailArc')}
          </h2>
          <div className="flex flex-col gap-2 p-4">
            {related.map((relatedPrayer) => (
              <Link
                className="group flex min-w-0 items-center gap-3 rounded-xl bg-neutral-100 p-3 transition hover:bg-primary-100"
                href={`/prayers/${relatedPrayer.slug}`}
                key={relatedPrayer.id}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-primary-900">
                    {relatedPrayer.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-neutral-500">
                    {relatedPrayer.churchName}
                  </span>
                </span>
                <ArrowRightOutlined className="shrink-0 text-sm text-primary-500 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {church.phone && phoneHref && (
        <section className="rounded-2xl bg-[image:linear-gradient(var(--color-overlay-navy),var(--color-overlay-navy)),url('/images/sanctuary-banner.webp')] bg-cover bg-center p-4 text-white shadow-[0_12px_36px_rgba(11,58,140,0.25)]">
          <div className="flex items-center gap-3 border-b border-white/15 pb-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <MaskIcon className="bg-white" size={18} src="/icons/icon-user-headset.svg" />
            </span>
            <h2 className="text-xl font-semibold leading-snug">{t('prayerDetailCrisisTitle')}</h2>
          </div>
          <p className="mt-4 text-xs leading-5 text-white/80">
            {t('prayerDetailCrisisBody', { church: church.name })}
          </p>
          <a
            aria-label={church.phone}
            className="mt-4 flex items-center gap-4 rounded-xl bg-white/10 p-4 text-white transition hover:bg-white/15 hover:text-white"
            href={`tel:${phoneHref}`}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-primary-500">
              <PhoneOutlined className="rotate-90" />
            </span>
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[2px] text-white/70">
                {t('prayerDetailCrisisLabel')}
              </span>
              <span className="block text-xl font-semibold">{church.phone}</span>
            </span>
          </a>
        </section>
      )}
    </aside>
  )
}
