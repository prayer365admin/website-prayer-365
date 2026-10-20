'use client'

import SiteButton from '@/components/common/button'
import { GuardIcon } from '@/components/icon/guard'
import { LockIcon } from '@/components/icon/lock'
import { UserDeleteIcon } from '@/components/icon/user-delete'
import { useSiteI18n } from '@/i18n/site-i18n'
import { CodeOutlined, DownloadOutlined, WarningOutlined } from '@ant-design/icons'
import s from './sacramental-privacy.module.scss'

// Data export and in-site account deletion are out of website scope (FEATURE "Out of scope"),
// so their actions render disabled until that backend is approved (WB1-P06).
export default function SacramentalPrivacy() {
  const { t } = useSiteI18n()
  const unavailable = t('profileNotAvailableYet')

  return (
    <article className={s.card}>
      <header className={s.heading}>
        <div>
          <h1>{t('profilePrivacyTitle')}</h1>
          <p>{t('profilePrivacySubtitle')}</p>
        </div>
        <span aria-hidden className={s.headingIcon}>
          <GuardIcon />
        </span>
      </header>

      <div className={s.body}>
        <section className={s.privilege}>
          <div className={s.privilegeBody}>
            <span aria-hidden className={s.privilegeIcon}>
              <GuardIcon />
            </span>
            <div>
              <h2>{t('profilePrivilegeHeading')}</h2>
              <p>{t('profilePrivilegeBody')}</p>
            </div>
          </div>
          {/* Design copy kept as requested; WB1 report R-08 tracks this claim before launch. */}
          <footer className={s.privilegeFooter}>
            <LockIcon aria-hidden />
            {t('profilePrivilegeFooter')}
          </footer>
        </section>

        <section className={s.exportRow}>
          <div>
            <h2>{t('profileExportHeading')}</h2>
            <p>{t('profileExportBody')}</p>
          </div>
          <div className={s.exportActions}>
            <SiteButton
              className={s.exportButton}
              disabled
              icon={<DownloadOutlined aria-hidden />}
              size="xs"
              title={unavailable}
            >
              {t('profileExportPdf')}
            </SiteButton>
            <SiteButton
              className={s.exportButton}
              disabled
              icon={<CodeOutlined aria-hidden />}
              size="xs"
              title={unavailable}
            >
              {t('profileExportJson')}
            </SiteButton>
          </div>
        </section>

        <section className={s.deletion}>
          <div className={s.deletionCopy}>
            <span aria-hidden className={s.deletionIcon}>
              <WarningOutlined />
            </span>
            <div>
              <h2>{t('profileDeletionHeading')}</h2>
              <p>{t('profileDeletionBody')}</p>
            </div>
          </div>
          <footer className={s.deletionFooter}>
            <p>{t('profileDeletionFooter')}</p>
            <SiteButton
              className={s.deleteButton}
              disabled
              icon={<UserDeleteIcon aria-hidden />}
              size="xs"
              title={unavailable}
            >
              {t('profileDeletionRequest')}
            </SiteButton>
          </footer>
        </section>
      </div>
    </article>
  )
}
