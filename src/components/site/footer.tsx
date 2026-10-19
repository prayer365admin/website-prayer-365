import { SanctuaryIcon } from '@/components/icon/sanctuary'
import Image from 'next/image'
import Link from 'next/link'
import s from './footer.module.scss'

const parishLinks = [
  ['Tallinn Deanery Directory', '/churches'],
  ['Helsinki Diocese Partners', '/churches'],
  ['Diaconal Food & Shelter Fund', '/giving'],
  ['Youth Ministry Gatherings', '/events'],
] as const

const policyLinks = [
  ['Privacy of Confession', '/privacy'],
  ['Terms of Fellowship', '/terms'],
  ['Pastoral Support', '/support'],
] as const

export default function SiteFooter({ legalOnly = false }: { legalOnly?: boolean }) {
  return (
    <footer className={`${s.footer} ${legalOnly ? s.legalOnly : ''}`}>
      <div className={s.inner}>
        <section aria-label="Prayer 365" className={s.identity}>
          <div className={s.brandLine}>
            <Image alt="" className={s.logo} height={28} src="/images/icon.jpg" width={28} />
            <strong>Prayer 365</strong>
            <span>Ecumenical Portal</span>
          </div>
          <blockquote>
            “The Lord bless you and keep you; the Lord make his face shine upon you and be gracious
            to you.”
          </blockquote>
          <p className={s.reference}>
            Numbers 6:24–25&nbsp; • &nbsp;In fellowship with EELK Baltic &amp; Nordic Ecumenical
            Council
          </p>
        </section>

        <nav aria-label="Parish network" className={s.parishNetwork}>
          <h2>Parish Network</h2>
          {parishLinks.map(([label, href]) => (
            <Link href={href} key={label}>
              {label}
            </Link>
          ))}
        </nav>

        <section className={s.support}>
          <h2>Pastoral Care &amp; Support</h2>
          <div className={s.hotline}>
            <span>24/7 Spiritual Hotline</span>
            <a href="tel:+3726441483">+372 644 1483</a>
            <span>Confidential chaplain consultation</span>
          </div>
        </section>

        <div className={s.legal}>
          <p>
            <SanctuaryIcon aria-hidden />
            <span>
              © 2024 Prayer 365 Sanctuary. Ecumenical Christian Devotional Network. All rights
              reserved in faith.
            </span>
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
