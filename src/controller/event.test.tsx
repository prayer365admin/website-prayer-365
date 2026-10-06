import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/event', () => ({
  CREATE_EVENT: vi.fn(),
  GET_EVENT: vi.fn(),
  LIST_EVENTS: vi.fn(),
  UPDATE_EVENT: vi.fn(),
}))
vi.mock('@/providers/church', () => ({ GET_AVAILABLE_LANGUAGE_CODES: vi.fn() }))

import { CREATE_EVENT, GET_EVENT, LIST_EVENTS, UPDATE_EVENT } from '@/providers/event'
import { GET_AVAILABLE_LANGUAGE_CODES } from '@/providers/church'
import { createEvent, listEvents, patchEvent } from './event'

const scope = new Set(['c1'])
const VALID_INPUT = {
  category: 'SERVICE' as const,
  title: 'Sunday Service',
  description: 'weekly',
  startsAt: '2026-10-01T10:00:00Z',
  location: 'Main Hall',
  registrationUrl: 'https://example.com/reg',
  languageCode: 'en',
}

const eventOut = { id: 'e1', churchId: 'c1', category: 'SERVICE', version: 3 }

beforeEach(() => vi.clearAllMocks())

describe('listEvents', () => {
  it('delegates to LIST_EVENTS', async () => {
    vi.mocked(LIST_EVENTS).mockResolvedValue({ result: [], total: 0 } as never)
    await expect(listEvents({ churchIds: scope, query: {} as never })).resolves.toEqual({
      result: [],
      total: 0,
    })
  })
})

describe('createEvent', () => {
  it('creates an event with a valid category/date/url/language', async () => {
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set(['en']))
    vi.mocked(CREATE_EVENT).mockResolvedValue(eventOut as never)
    const res = await createEvent({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      input: VALID_INPUT,
      requestId: 'r',
    })
    expect(CREATE_EVENT).toHaveBeenCalledWith(expect.objectContaining({ churchId: 'c1' }))
    expect(res).toEqual(eventOut)
  })

  it('throws 403 for a cross-church caller', async () => {
    await expect(
      createEvent({
        userId: 'u1',
        churchId: 'c9',
        churchIds: scope,
        input: VALID_INPUT,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('throws 422 for an unknown language', async () => {
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set())
    await expect(
      createEvent({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        input: VALID_INPUT,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'UNKNOWN_LANGUAGE' })
  })
})

describe('patchEvent', () => {
  it('updates an event', async () => {
    vi.mocked(GET_EVENT).mockResolvedValue({ ...eventOut, version: 3 } as never)
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set(['en']))
    vi.mocked(UPDATE_EVENT).mockResolvedValue({ ...eventOut, version: 4 } as never)
    const res = await patchEvent({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      eventId: 'e1',
      input: { ...VALID_INPUT, version: 3 },
      requestId: 'r',
    })
    expect(GET_EVENT).toHaveBeenCalledWith({
      churchId: 'c1',
      churchIds: scope,
      eventId: 'e1',
    })
    expect(UPDATE_EVENT).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', expectedVersion: 3 }),
    )
    expect(res).toEqual({ ...eventOut, version: 4 })
  })

  it('throws 409 on stale version', async () => {
    vi.mocked(GET_EVENT).mockResolvedValue({ ...eventOut, version: 9 } as never)
    await expect(
      patchEvent({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        eventId: 'e1',
        input: { ...VALID_INPUT, version: 3 },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
  })

  it('throws 404 when the event is not in scope', async () => {
    vi.mocked(GET_EVENT).mockResolvedValue(null as never)
    await expect(
      patchEvent({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        eventId: 'e9',
        input: { ...VALID_INPUT, version: 3 },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 404 })
  })

  it('throws 422 when version is missing', async () => {
    await expect(
      patchEvent({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        eventId: 'e1',
        input: {
          category: 'SERVICE',
          title: 'x',
          description: 'y',
          startsAt: VALID_INPUT.startsAt,
          location: 'z',
        },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422 })
  })
})
