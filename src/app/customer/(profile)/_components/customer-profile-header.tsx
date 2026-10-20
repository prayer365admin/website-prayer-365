'use client'

import { useMe, useMyChurches } from '@/hooks/data/site/me'
import type { MobileMe, MobileMyChurch } from '@/models/mobile'
import { ChurchIcon } from '@/components/icon/church'
import { PersonIcon } from '@/components/icon/person'
import { VerifyIcon } from '@/components/icon/verify'
import { PhoneOutlined } from '@ant-design/icons'
import { Avatar, Button } from 'antd'
import s from './customer-profile-header.module.scss'

const memberNumber = (userId: string) => {
  const compact = userId.replaceAll('-', '').toUpperCase()
  return `#${compact.slice(0, 4)}-${compact.slice(-4)}`
}

const memberSince = (createdAt: string) =>
  new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(createdAt))

export default function CustomerProfileHeader({
  createdAt,
  initialChurches,
  initialMe,
  verified,
}: {
  createdAt: string
  initialChurches: MobileMyChurch[]
  initialMe: MobileMe
  verified: boolean
}) {
  const { data: me } = useMe({ userId: initialMe.id, initialData: initialMe })
  const { data: churches } = useMyChurches({
    userId: initialMe.id,
    initialData: initialChurches,
  })
  const customer = me ?? initialMe
  const primaryChurch = churches.find((church) => church.isMain)

  return (
    <header className={s.header}>
      <section className={s.identity}>
        <Avatar
          icon={<PersonIcon />}
          shape="square"
          size={72}
          src={customer.profilePicture ?? undefined}
        />
        <div className={s.identityDetails}>
          <div className={s.nameLine}>
            <h1>{customer.name}</h1>
            {verified && (
              <span className={s.verified}>
                <VerifyIcon aria-hidden />
                EELK Baptized / Verified Parishioner
              </span>
            )}
          </div>
          <p>
            <span>{memberNumber(customer.id)}</span>
            <span aria-hidden>•</span>
            <span>Member since {memberSince(createdAt)}</span>
          </p>
        </div>
      </section>

      <div className={s.rightColumn}>
        <section className={`${s.infoCard} ${s.chaplainCard}`}>
          <span className={s.infoIcon}>
            <PhoneOutlined aria-hidden />
          </span>
          <div className={s.infoText}>
            <span>Assigned Chaplain</span>
            <strong>Not assigned</strong>
          </div>
          <Button disabled>Direct Note</Button>
        </section>

        <section className={`${s.infoCard} ${s.churchCard}`}>
          <Avatar
            className={s.churchImage}
            icon={<ChurchIcon />}
            shape="square"
            size={56}
            src={primaryChurch?.coverUrl ?? undefined}
          />
          <div className={s.infoText}>
            <span>Primary Sanctuary</span>
            <strong>{primaryChurch?.churchName ?? 'Not selected'}</strong>
          </div>
        </section>
      </div>
    </header>
  )
}
