'use client'

import SiteButton from '@/components/common/button'
import { SearchIcon } from '@/components/icon/search'
import { VerifyIcon } from '@/components/icon/verify'
import { useChurchOptions } from '@/hooks/data/site/church-option'
import { useSiteI18n } from '@/i18n/site-i18n'
import type { ChurchOption } from '@/models/church-option'
import type { MobileMyChurch } from '@/models/mobile'
import { Avatar, Drawer, Input } from 'antd'
import { useState } from 'react'
import s from './church-affiliations.module.scss'

const churchImagePlaceholder = '/images/placeholder.png'

const relationFromOption = (church: ChurchOption): MobileMyChurch => ({
  churchId: church.id,
  churchName: church.name,
  city: church.city,
  address: church.city,
  coverAssetId: null,
  coverUrl: null,
  isMain: false,
  isFollowed: true,
})

const byName = (a: MobileMyChurch, b: MobileMyChurch) =>
  a.churchName.localeCompare(b.churchName, undefined, { sensitivity: 'base' })

/**
 * Church picker for the profile Church Affiliations card. Edits a draft of the
 * customer's relations; nothing is persisted until Save hands the draft back.
 * Mount it with a fresh `key` per opening so every session starts from the
 * current relations.
 */
export default function ChurchPickerDrawer({
  open,
  churches,
  mainId,
  saving,
  onCancel,
  onSave,
}: {
  open: boolean
  churches: MobileMyChurch[]
  mainId: string | null
  saving: boolean
  onCancel: () => void
  onSave: (churches: MobileMyChurch[], mainId: string | null) => void
}) {
  const { t } = useSiteI18n()
  const [draft, setDraft] = useState(churches)
  const [draftMainId, setDraftMainId] = useState(mainId)
  const [search, setSearch] = useState('')
  const { data: options, loading: searching } = useChurchOptions(search)

  const needle = search.trim().toLocaleLowerCase()
  const matches = (church: MobileMyChurch) =>
    !needle || church.churchName.toLocaleLowerCase().includes(needle)
  const isFollowed = (church: MobileMyChurch) =>
    church.isFollowed || church.churchId === draftMainId

  // Primary first, then the rest alphabetically.
  const followed = draft
    .filter((church) => isFollowed(church) && matches(church))
    .sort((a, b) =>
      a.churchId === draftMainId ? -1 : b.churchId === draftMainId ? 1 : byName(a, b),
    )
  const followedIds = new Set(draft.filter(isFollowed).map((church) => church.churchId))
  // Search results plus churches unfollowed in this session (they may be outside the result page).
  const notFollowed = Array.from(
    new Map(
      [
        ...draft.filter((church) => !isFollowed(church) && matches(church)),
        ...options.map(relationFromOption),
      ]
        .filter((church) => !followedIds.has(church.churchId))
        .map((church) => [church.churchId, { ...church, isFollowed: false }]),
    ).values(),
  ).sort(byName)

  const setFollow = (church: MobileMyChurch, value: boolean) =>
    setDraft((current) =>
      current.some((row) => row.churchId === church.churchId)
        ? current.map((row) =>
            row.churchId === church.churchId ? { ...row, isFollowed: value } : row,
          )
        : [...current, { ...church, isFollowed: value }],
    )

  const makePrimary = (church: MobileMyChurch) => {
    setFollow(church, true)
    setDraftMainId(church.churchId)
  }

  const row = (church: MobileMyChurch) => {
    const primary = church.churchId === draftMainId
    const following = followedIds.has(church.churchId)
    return (
      <li className={s.pickerRow} key={church.churchId}>
        <Avatar shape="square" size={40} src={church.coverUrl ?? churchImagePlaceholder} />
        <div className={s.pickerName}>
          <strong>{church.churchName}</strong>
          <small>{church.address ?? church.city ?? t('profileLocationUnavailable')}</small>
        </div>
        {primary ? (
          <span className={s.pickerPrimaryBadge}>
            <VerifyIcon aria-hidden /> {t('profilePrimaryParishBadge')}
          </span>
        ) : (
          <div className={s.pickerActions}>
            <SiteButton
              aria-label={t('profileSetPrimaryAria', { church: church.churchName })}
              onClick={() => makePrimary(church)}
              size="xs"
            >
              {t('profileMakePrimary')}
            </SiteButton>
            {following ? (
              <SiteButton
                aria-label={t('profileUnfollowAria', { church: church.churchName })}
                onClick={() => setFollow(church, false)}
                size="xs"
                variant="outlined"
              >
                {t('profileUnfollow')}
              </SiteButton>
            ) : (
              <SiteButton
                aria-label={t('profileFollowAria', { church: church.churchName })}
                onClick={() => setFollow(church, true)}
                size="xs"
                variant="outlined"
              >
                {t('profileFollow')}
              </SiteButton>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    // Side drawer on desktop; `min()` makes it full screen width on phones.
    <Drawer
      footer={
        <div className={s.pickerFooter}>
          <SiteButton disabled={saving} onClick={onCancel} size="md" variant="outlined">
            {t('profileCancel')}
          </SiteButton>
          <SiteButton loading={saving} onClick={() => onSave(draft, draftMainId)} size="md">
            {t('profileSaveChanges')}
          </SiteButton>
        </div>
      }
      mask={{ closable: !saving }}
      onClose={saving ? undefined : onCancel}
      open={open}
      placement="right"
      size="min(600px, 100vw)"
      title={t('profileManageChurchesTitle')}
    >
      <Input
        allowClear
        aria-label={t('profileSearchPlaceholder')}
        className={s.pickerSearch}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('profileSearchPlaceholder')}
        prefix={<SearchIcon aria-hidden className={s.searchIcon} />}
        value={search}
      />
      <div className={s.pickerBody}>
        <section aria-labelledby="picker-followed">
          <h3 className={s.pickerHeading} id="picker-followed">
            {t('profileFollowedSection')}
          </h3>
          {followed.length ? (
            <ul className={s.pickerList}>{followed.map(row)}</ul>
          ) : (
            <p className={s.pickerEmpty}>
              {needle ? t('profileNoChurchesFound') : t('profileNoFollowed')}
            </p>
          )}
        </section>
        <section aria-labelledby="picker-others">
          <h3 className={s.pickerHeading} id="picker-others">
            {t('profileOtherChurchesSection')}
          </h3>
          {searching && !notFollowed.length ? (
            <p className={s.pickerEmpty}>{t('profileSearching')}</p>
          ) : notFollowed.length ? (
            <ul className={s.pickerList}>{notFollowed.map(row)}</ul>
          ) : (
            <p className={s.pickerEmpty}>{t('profileNoChurchesFound')}</p>
          )}
        </section>
      </div>
    </Drawer>
  )
}
