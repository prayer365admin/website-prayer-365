import dayjs from 'dayjs'
import { afterEach, describe, expect, it } from 'vitest'
import {
  churchDateTimeToEventInstant,
  churchFilterBoundToIso,
  EVENT_EDITOR_DATETIME_FORMAT,
  EVENT_TABLE_DATETIME_FORMAT,
  eventInstantToChurchEditorDateTime,
  eventInstantToChurchDateTime,
  eventOffsetLabel,
  eventStartStatus,
  formatEventStart,
} from './event-datetime'

const TALLINN = 'Europe/Tallinn'
const originalTimezone = process.env.TZ

afterEach(() => {
  process.env.TZ = originalTimezone
})

describe('Event datetime boundary', () => {
  it('round-trips a normal Tallinn winter time with its explicit offset', () => {
    const converted = churchDateTimeToEventInstant('2026-02-15 10:00', TALLINN)

    expect(converted).toEqual({ ok: true, iso: '2026-02-15T10:00:00+02:00' })
    if (converted.ok) {
      expect(
        eventInstantToChurchDateTime(converted.iso, TALLINN).format(EVENT_EDITOR_DATETIME_FORMAT),
      ).toBe('2026-02-15 10:00')
    }
  })

  it('round-trips a normal Tallinn summer time with its explicit offset', () => {
    const converted = churchDateTimeToEventInstant('2026-07-15 10:00', TALLINN)

    expect(converted).toEqual({ ok: true, iso: '2026-07-15T10:00:00+03:00' })
    if (converted.ok) {
      expect(new Date(converted.iso).toISOString()).toBe('2026-07-15T07:00:00.000Z')
    }
  })

  it('rejects a nonexistent wall time during the Tallinn spring-forward gap', () => {
    expect(churchDateTimeToEventInstant('2026-03-29 03:30', TALLINN)).toMatchObject({
      ok: false,
      code: 'NONEXISTENT_LOCAL_TIME',
      message: expect.stringContaining('does not exist'),
    })
  })

  it('rejects an ambiguous wall time during the Tallinn fall-back overlap', () => {
    expect(churchDateTimeToEventInstant('2026-10-25 03:30', TALLINN)).toMatchObject({
      ok: false,
      code: 'AMBIGUOUS_LOCAL_TIME',
      message: expect.stringContaining('happens twice'),
    })
  })

  it('displays a stored instant in the church timezone for editing and tables', () => {
    const local = eventInstantToChurchDateTime('2026-10-25T00:30:00Z', TALLINN)

    expect(local.format(EVENT_EDITOR_DATETIME_FORMAT)).toBe('2026-10-25 03:30')
    expect(local.format('Z')).toBe('+03:00')
    expect(formatEventStart('2026-02-15T08:00:00Z', TALLINN)).toBe('15 Feb 2026, 10:00')
    expect(EVENT_TABLE_DATETIME_FORMAT).toBe('DD MMM YYYY, HH:mm')
  })

  it('creates a floating church wall-clock value for the date picker', () => {
    process.env.TZ = 'Asia/Makassar'
    const editorValue = eventInstantToChurchEditorDateTime('2026-02-15T08:00:00Z', 'Europe/Tallinn')

    expect(editorValue.format(EVENT_EDITOR_DATETIME_FORMAT)).toBe('2026-02-15 10:00')
  })

  it('accepts a Dayjs editor value by its wall-clock components', () => {
    const editorValue = dayjs.utc('2026-02-15T10:00:00Z')

    expect(churchDateTimeToEventInstant(editorValue, TALLINN)).toEqual({
      ok: true,
      iso: '2026-02-15T10:00:00+02:00',
    })
  })

  it('does not depend on the process timezone', () => {
    process.env.TZ = 'Pacific/Honolulu'
    const fromHonolulu = churchDateTimeToEventInstant('2026-02-15 10:00', TALLINN)
    process.env.TZ = 'Asia/Tokyo'
    const fromTokyo = churchDateTimeToEventInstant('2026-02-15 10:00', TALLINN)

    expect(fromHonolulu).toEqual(fromTokyo)
    expect(fromTokyo).toEqual({ ok: true, iso: '2026-02-15T10:00:00+02:00' })
  })

  it('returns useful validation for malformed values and timezones', () => {
    expect(churchDateTimeToEventInstant('2026-02-30 10:00', TALLINN)).toMatchObject({
      ok: false,
      code: 'INVALID_LOCAL_TIME',
    })
    expect(churchDateTimeToEventInstant('2026-02-15 10:00', 'Not/A_Zone')).toMatchObject({
      ok: false,
      code: 'INVALID_TIMEZONE',
    })
  })
})

describe('eventStartStatus', () => {
  const now = dayjs.utc('2026-02-10T08:00:00Z') // 10:00 Tallinn
  const status = (iso: string) => eventStartStatus(iso, 'Europe/Tallinn', now)

  it('flags upcoming and past events', () => {
    expect(status('2026-02-10T15:00:00Z')?.label).toBe('Today')
    expect(status('2026-02-11T15:00:00Z')?.label).toBe('Tomorrow')
    expect(status('2026-02-13T10:00:00Z')).toEqual({ label: 'In 3 days', color: 'orange' })
    expect(status('2026-02-17T10:00:00Z')).toEqual({ label: 'In 7 days', color: 'gold' })
    expect(status('2026-02-18T10:00:00Z')).toBeNull()
    expect(status('2026-02-09T10:00:00Z')?.label).toBe('Past')
  })

  it('converts a church-local filter bound to an instant', () => {
    expect(churchFilterBoundToIso(dayjs('2026-02-15 10:00'), 'Europe/Tallinn')).toBe(
      '2026-02-15T08:00:00.000Z',
    )
  })
})

describe('eventOffsetLabel', () => {
  it('shows the resolved church offset, or nothing for gap/overlap/empty', () => {
    expect(eventOffsetLabel(dayjs('2026-02-15 10:00'), TALLINN)).toBe('UTC+02:00')
    expect(eventOffsetLabel(dayjs('2026-07-15 10:00'), TALLINN)).toBe('UTC+03:00')
    expect(eventOffsetLabel(dayjs('2026-03-29 03:30'), TALLINN)).toBeNull()
    expect(eventOffsetLabel(dayjs('2026-10-25 03:30'), TALLINN)).toBeNull()
    expect(eventOffsetLabel(undefined, TALLINN)).toBeNull()
  })
})
