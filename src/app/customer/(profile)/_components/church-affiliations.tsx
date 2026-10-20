'use client'

import SiteButton from '@/components/common/button'
import { CalendarWeekIcon } from '@/components/icon/calendar-week'
import { LocationIcon } from '@/components/icon/location'
import { LocationPlusIcon } from '@/components/icon/location-plus'
import { SearchIcon } from '@/components/icon/search'
import { UnbookmarkIcon } from '@/components/icon/unbookmark'
import { VerifyIcon } from '@/components/icon/verify'
import { useUpcomingChurchEvents } from '@/hooks/data/site/church-event'
import { useChurchOptions } from '@/hooks/data/site/church-option'
import { useMe, useMyChurches } from '@/hooks/data/site/me'
import type { ChurchOption } from '@/models/church-option'
import type { MobileMe, MobileMyChurch, MobilePublicEvent } from '@/models/mobile'
import { App, Avatar, Input } from 'antd'
import type { InputRef } from 'antd'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import s from './church-affiliations.module.scss'

const churchImagePlaceholder = '/images/placeholder.png'
const EVENT_ROTATION_MS = 7000
// ponytail: no per-church notification preference exists yet, so every row is off; read it
// from the church relation once that field is stored.
const notificationsOn = false

const formatEventStart = (startsAt: string) => {
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

function ChurchEventTicker({ events }: { events: MobilePublicEvent[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReduceMotion(media.matches)
    updatePreference()
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (events.length < 2 || paused || reduceMotion) return
    const interval = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % events.length),
      EVENT_ROTATION_MS,
    )
    return () => window.clearInterval(interval)
  }, [events.length, paused, reduceMotion])

  if (!events.length) return null

  const visibleIndex = activeIndex % events.length

  return (
    <div
      aria-label="Upcoming parish events"
      className={s.eventTicker}
      onBlur={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="group"
      tabIndex={0}
    >
      <CalendarWeekIcon aria-hidden className={s.eventIcon} />
      <div className={s.eventSlides}>
        {events.map((event, index) => (
          <span
            aria-hidden={index !== visibleIndex}
            className={`${s.eventSlide} ${index === visibleIndex ? s.eventSlideActive : ''}`}
            key={event.id}
            title={`${event.title} — ${formatEventStart(event.startsAt)}`}
          >
            <strong>{event.title}</strong>
            <span aria-hidden>:</span> {formatEventStart(event.startsAt)}
          </span>
        ))}
      </div>
    </div>
  )
}

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

const followedIds = (churches: MobileMyChurch[], mainId: string | null) =>
  churches
    .filter((church) => church.isFollowed || church.churchId === mainId)
    .map((church) => church.churchId)
    .sort()

export default function ChurchAffiliations({
  initialChurches,
  initialMe,
}: {
  initialChurches: MobileMyChurch[]
  initialMe: MobileMe
}) {
  const { message } = App.useApp()
  const { onPatch } = useMe({ userId: initialMe.id, initialData: initialMe })
  const { onFollow } = useMyChurches({ userId: initialMe.id, initialData: initialChurches })
  const [savedChurches, setSavedChurches] = useState(initialChurches)
  const [churches, setChurches] = useState(initialChurches)
  const [savedMainId, setSavedMainId] = useState(initialMe.mainChurchId)
  const [mainId, setMainId] = useState(initialMe.mainChurchId)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [changingPrimary, setChangingPrimary] = useState(false)
  const searchRef = useRef<InputRef>(null)
  const { data: options, loading: searching } = useChurchOptions(search)
  const { data: upcomingEvents } = useUpcomingChurchEvents(mainId)

  const mainChurch = churches.find((church) => church.churchId === mainId)
  const followed = churches.filter((church) => church.isFollowed && church.churchId !== mainId)
  const availableOptions = options.filter(
    (option) => !churches.some((church) => church.churchId === option.id && church.isFollowed),
  )
  const dirty = useMemo(
    () =>
      mainId !== savedMainId ||
      followedIds(churches, mainId).join('|') !== followedIds(savedChurches, savedMainId).join('|'),
    [churches, mainId, savedChurches, savedMainId],
  )

  const addChurch = (option: ChurchOption, makePrimary = false) => {
    setChurches((current) => {
      const existing = current.find((church) => church.churchId === option.id)
      if (existing) {
        return current.map((church) =>
          church.churchId === option.id ? { ...church, isFollowed: true } : church,
        )
      }
      return [...current, relationFromOption(option)]
    })
    if (makePrimary) setMainId(option.id)
    setSearch('')
  }

  const removeFollow = (churchId: string) => {
    setChurches((current) =>
      current.map((church) =>
        church.churchId === churchId ? { ...church, isFollowed: false } : church,
      ),
    )
  }

  const cancel = () => {
    setChurches(savedChurches)
    setMainId(savedMainId)
    setSearch('')
    setChangingPrimary(false)
  }

  const beginPrimaryChange = () => {
    setChangingPrimary(true)
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  const save = async () => {
    setSaving(true)
    try {
      if (mainId !== savedMainId) await onPatch({ mainChurchId: mainId })

      const ids = new Set([
        ...savedChurches.map((church) => church.churchId),
        ...churches.map((church) => church.churchId),
      ])
      await Promise.all(
        Array.from(ids).flatMap((churchId) => {
          const before =
            savedChurches.find((church) => church.churchId === churchId)?.isFollowed ?? false
          const after =
            churchId === mainId ||
            (churches.find((church) => church.churchId === churchId)?.isFollowed ?? false)
          return before === after ? [] : [onFollow({ churchId, isFollowed: after })]
        }),
      )

      const next = churches.map((church) => ({
        ...church,
        isMain: church.churchId === mainId,
        isFollowed: church.churchId === mainId || church.isFollowed,
      }))
      setChurches(next)
      setSavedChurches(next)
      setSavedMainId(mainId)
      setChangingPrimary(false)
      message.success('Church affiliations saved.')
    } catch {
      message.error('We could not save your church affiliations.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={s.card}>
      <section
        className={s.hero}
        style={
          {
            '--hero-image': `url("${mainChurch?.coverUrl ?? churchImagePlaceholder}")`,
          } as CSSProperties
        }
      >
        <header className={s.heroHeading}>
          <div>
            <h1>Church Affiliations &amp; Parishes</h1>
            <p>Ecumenical Connectivity</p>
          </div>
          <p>
            {mainChurch ? '1 Primary Parish' : 'No Primary Parish'} <span aria-hidden>•</span>{' '}
            {followed.length} Followed {followed.length === 1 ? 'Congregation' : 'Congregations'}
          </p>
        </header>

        <div className={s.primaryDetails}>
          {mainChurch ? (
            <>
              <div
                className={`${s.primaryCopy} ${upcomingEvents.length ? '' : s.primaryCopyWithoutEvents}`}
              >
                <span className={s.primaryBadge}>
                  <VerifyIcon aria-hidden /> Primary Parish
                </span>
                <h2>{mainChurch.churchName}</h2>
                {mainChurch.city && (
                  <p>
                    <LocationIcon aria-hidden className={s.primaryLocationIcon} /> {mainChurch.city}
                  </p>
                )}
                <ChurchEventTicker events={upcomingEvents} key={mainId} />
              </div>
              <div className={s.primaryActions}>
                <SiteButton
                  className={s.dashboardButton}
                  disabled
                  size="sm"
                  title="A customer-facing parish details page is not available yet"
                  variant="outlined"
                >
                  Parish Dashboard
                </SiteButton>
                <SiteButton
                  className={s.changePrimaryButton}
                  onClick={beginPrimaryChange}
                  size="sm"
                >
                  Change Primary Parish
                </SiteButton>
              </div>
            </>
          ) : (
            <>
              <div className={s.primaryCopy}>
                <h2>No primary parish selected</h2>
                <p>Search below to select your primary parish.</p>
              </div>
              <SiteButton className={s.changePrimaryButton} onClick={beginPrimaryChange} size="sm">
                Select Primary Parish
              </SiteButton>
            </>
          )}
        </div>
      </section>

      <section className={s.followedHeading}>
        <h2>Spiritual Reflections &amp; Calling</h2>
        <p>Receive bulletins, livestream notices &amp; prayer chains</p>
      </section>

      <section className={s.followedContent}>
        <div className={s.churchList}>
          {followed.length ? (
            followed.map((church) => (
              <div className={s.churchRow} key={church.churchId}>
                <Avatar shape="square" size={48} src={church.coverUrl ?? churchImagePlaceholder} />
                <div>
                  <strong>{church.churchName}</strong>
                  <div className={s.churchMeta}>
                    <span>{church.address ?? church.city ?? 'Location unavailable'}</span>
                  </div>
                </div>
                <div className={s.rowActions}>
                  <SiteButton
                    aria-label={
                      changingPrimary
                        ? `Set ${church.churchName} as primary parish`
                        : `Notifications ${notificationsOn ? 'on' : 'off'} for ${church.churchName}`
                    }
                    className={s.notificationButton}
                    disabled={!changingPrimary}
                    onClick={() => setMainId(church.churchId)}
                    size="xs"
                    title={
                      changingPrimary
                        ? undefined
                        : 'Per-parish notification preferences are not supported yet'
                    }
                  >
                    {changingPrimary
                      ? 'Set as Primary'
                      : notificationsOn
                        ? 'Notifications On'
                        : 'Notifications Off'}
                  </SiteButton>
                  <SiteButton
                    aria-label={`Unfollow ${church.churchName}`}
                    className={s.unfollowButton}
                    icon={<UnbookmarkIcon aria-hidden />}
                    onClick={() => removeFollow(church.churchId)}
                    size="xs"
                    variant="outlined"
                  >
                    <span className="sr-only">Unfollow</span>
                  </SiteButton>
                </div>
              </div>
            ))
          ) : (
            <p className={s.empty}>No additional churches followed yet.</p>
          )}
        </div>

        <div className={s.searchArea}>
          <div>
            <LocationPlusIcon aria-hidden className={s.locationPlusIcon} />
            <span>Add another parish or monastery</span>
          </div>
          <Input
            allowClear
            ref={searchRef}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by parish or city..."
            prefix={<SearchIcon aria-hidden className={s.searchIcon} />}
            value={search}
          />
          {search.trim() && (
            <div className={s.results}>
              {searching ? (
                <span>Searching…</span>
              ) : availableOptions.length ? (
                availableOptions.map((option) => (
                  <div key={option.id}>
                    <span>
                      <strong>{option.name}</strong>
                      {option.city && <small>{option.city}</small>}
                    </span>
                    <SiteButton onClick={() => addChurch(option)} size="xs" variant="outlined">
                      Follow
                    </SiteButton>
                    <SiteButton onClick={() => addChurch(option, true)} size="xs">
                      Make Primary
                    </SiteButton>
                  </div>
                ))
              ) : (
                <span>No approved churches found.</span>
              )}
            </div>
          )}
        </div>
      </section>

      <footer className={s.actions}>
        <SiteButton disabled={!dirty || saving} onClick={cancel} size="md" variant="outlined">
          Cancel
        </SiteButton>
        <SiteButton disabled={!dirty} loading={saving} onClick={save} size="md">
          Save Changes
        </SiteButton>
      </footer>
    </article>
  )
}
