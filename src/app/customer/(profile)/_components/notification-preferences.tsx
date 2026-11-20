'use client'

import { siteFormTheme } from '@/config/antdTheme'
import { useNotificationPreferences } from '@/hooks/data/site/notification-preferences'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MobileNotificationPreferences } from '@/models/mobile'
import { App, Card, ConfigProvider, Skeleton, Switch, Typography } from 'antd'
import s from './notification-preferences.module.scss'

const ROWS = [
  { key: 'dailyPrayer', labelKey: 'profileNotifDailyPrayer' },
  { key: 'churchPrayer', labelKey: 'profileNotifChurchPrayer' },
  { key: 'churchEvents', labelKey: 'profileNotifChurchEvents' },
  { key: 'announcements', labelKey: 'profileNotifAnnouncements' },
  { key: 'donationReminder', labelKey: 'profileNotifDonationReminder' },
] as const

/**
 * Customer notification preferences (WB-17). One switch per notification type,
 * the same six keys the mobile app writes; the daily prayer email arrives only
 * while its switch is on. Every toggle saves the whole object, so the server
 * never has to merge a partial update.
 */
export default function NotificationPreferences({
  initial,
}: {
  initial: MobileNotificationPreferences
}) {
  const { t } = useSiteI18n()
  const { message } = App.useApp()
  const { data, loading, onSave, saving } = useNotificationPreferences(initial)

  if (loading || !data) return <Skeleton active />

  const toggle = async (key: keyof MobileNotificationPreferences, checked: boolean) => {
    try {
      await onSave({ ...data, [key]: checked })
      message.success(t('profileNotifSaved'))
    } catch {
      message.error(t('profileNotifSaveError'))
    }
  }

  return (
    <ConfigProvider theme={siteFormTheme}>
      <Card title={t('profileNotifTitle')}>
        <Typography.Paragraph type="secondary">{t('profileNotifIntro')}</Typography.Paragraph>
        {ROWS.map(({ key, labelKey }) => (
          <div className={s.row} key={key}>
            <span className={s.label}>{t(labelKey)}</span>
            <Switch
              aria-label={t(labelKey)}
              checked={data[key]}
              disabled={saving}
              onChange={(checked) => toggle(key, checked)}
            />
          </div>
        ))}
      </Card>
    </ConfigProvider>
  )
}
