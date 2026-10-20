'use client'

import SiteButton from '@/components/common/button'
import { GuardIcon } from '@/components/icon/guard'
import { LockIcon } from '@/components/icon/lock'
import { UserDeleteIcon } from '@/components/icon/user-delete'
import { CodeOutlined, DownloadOutlined, WarningOutlined } from '@ant-design/icons'
import s from './sacramental-privacy.module.scss'

// Data export and in-site account deletion are out of website scope (FEATURE "Out of scope"),
// so their actions render disabled until that backend is approved (WB1-P06).
const unavailable = 'Not available yet'

export default function SacramentalPrivacy() {
  return (
    <article className={s.card}>
      <header className={s.heading}>
        <div>
          <h1>Sacramental Privacy &amp; Data Stewardship</h1>
          <p>Vow of Sacred Trust</p>
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
              <h2>Pastoral Privilege &amp; Canon Law Protection</h2>
              <p>
                Pastoral conversations, confession-support entries, and intercessory prayer
                intentions submitted to the altar ministry are held under ecclesiastical seal of
                confession and strict pastoral confidentiality. They are never monitored, mined for
                advertising, or transferred to secular data entities.
              </p>
            </div>
          </div>
          {/* Design copy kept as requested; WB1 report R-08 tracks this claim before launch. */}
          <footer className={s.privilegeFooter}>
            <LockIcon aria-hidden />
            256-bit zero-knowledge encryption applied to personal journal entries.
          </footer>
        </section>

        <section className={s.exportRow}>
          <div>
            <h2>Export Your Spiritual Archive</h2>
            <p>
              Download all devotional journals, prayer chains, and certified tax giving receipts.
            </p>
          </div>
          <div className={s.exportActions}>
            <SiteButton
              className={s.exportButton}
              disabled
              icon={<DownloadOutlined aria-hidden />}
              size="xs"
              title={unavailable}
            >
              PDF Archive
            </SiteButton>
            <SiteButton
              className={s.exportButton}
              disabled
              icon={<CodeOutlined aria-hidden />}
              size="xs"
              title={unavailable}
            >
              JSON Data
            </SiteButton>
          </div>
        </section>

        <section className={s.deletion}>
          <div className={s.deletionCopy}>
            <span aria-hidden className={s.deletionIcon}>
              <WarningOutlined />
            </span>
            <div>
              <h2>Account Suspension &amp; Permanent Deletion</h2>
              <p>
                We maintain a 14-day peaceful grace window. If requested, your parish profile,
                membership roll link, and prayer log entries will be queued for permanent
                irreversible destruction. All communications cease immediately.
              </p>
            </div>
          </div>
          <footer className={s.deletionFooter}>
            <p>Need pastoral guidance before leaving? Speak with your parish chaplain.</p>
            <SiteButton
              className={s.deleteButton}
              disabled
              icon={<UserDeleteIcon aria-hidden />}
              size="xs"
              title={unavailable}
            >
              Request Account Deletion (14-day Grace Period)
            </SiteButton>
          </footer>
        </section>
      </div>
    </article>
  )
}
