'use client'

import { BellRingIcon } from '@/components/icon/bell-ring'
import { GuardIcon } from '@/components/icon/guard'
import { SunIcon } from '@/components/icon/sun'
import { useSiteI18n } from '@/i18n/site-i18n'
import { CaretRightFilled, SoundOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar } from 'antd'
import Image from 'next/image'
import Pill from './pill'

/*
 * Sign-in side panels (WB1 design). Content is HARDCODED for now (decision F2,
 * REPORT R-05): no live stream, player, reminder or stats exist yet, so the
 * player is decorative, not a button.
 */
export default function SignInAside() {
  const { t } = useSiteI18n()

  return (
    <>
      <section className="rounded-2xl bg-gradient-to-br from-accent_color_2 to-primary_color p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em]">
            <span aria-hidden className="h-2 w-2 rounded-full bg-white" />
            {t('liveStreamLabel')}
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <SunIcon aria-hidden style={{ fontSize: 20, color: '#fff' }} />
          </span>
        </div>

        <div className="mt-4 flex flex-col items-center text-center">
          <Image alt="" className="rounded-2xl" height={64} src="/images/icon.jpg" width={64} />
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/80">
            {t('liveWhisperLabel')}
          </p>
          <h2 className="mt-2 font-font_quote text-3xl leading-tight">{t('liveWhisperTitle')}</h2>
          <p className="mt-3 text-sm text-white/80">{t('liveWhisperMembers')}</p>
        </div>

        <div aria-hidden className="mt-4 flex items-center gap-3 rounded-xl bg-white/10 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-accent_color_2">
            <CaretRightFilled />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t('livePlayerTitle')}</p>
            <p className="truncate text-sm text-white/80">{t('livePlayerSubtitle')}</p>
          </div>
          <span className="flex items-center gap-1 text-xs uppercase">
            <SoundOutlined />
            {t('livePlayerBadge')}
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_rgba(15,40,80,0.06)]">
        <div className="flex items-center justify-between gap-2">
          <Pill icon={<BellRingIcon aria-hidden />}>{t('bellPill')}</Pill>
          <span className="text-sm text-gray-500">{t('bellTime')}</span>
        </div>
        <p className="mt-4 text-gray-600">{t('bellBody')}</p>
        <div className="mt-4 flex items-center gap-3">
          <Avatar.Group>
            {[0, 1, 2].map((i) => (
              <Avatar key={i} className="!bg-accent_color_2" icon={<UserOutlined />} size="small" />
            ))}
          </Avatar.Group>
          <span className="text-sm font-medium text-accent_color_1">{t('bellPastors')}</span>
        </div>
      </section>

      <section className="flex gap-4 rounded-2xl bg-gradient-to-br from-white to-[#eef4fb] p-5 shadow-[0_8px_30px_rgba(15,40,80,0.06)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary_color/30">
          <GuardIcon aria-hidden style={{ fontSize: 20, color: '#204B92' }} />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-accent_color_1">{t('sealTitle')}</h3>
          <p className="mt-1 text-gray-600">{t('sealBody')}</p>
        </div>
      </section>
    </>
  )
}
