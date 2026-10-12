import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsChurchRequestDetail from './detail'

const m = vi.hoisted(() => ({ useRequest: vi.fn() }))
vi.mock('@/hooks/data/request', () => ({ useRequest: m.useRequest }))

const request = {
  id: 'q1',
  kind: 'prayer',
  subject: 'Prayer for family',
  message: 'Line one\n<b>not bold</b>',
  classification: 'private',
  contactMethod: 'email',
  phone: null,
  email: 'member@example.org',
  availability: null,
  createdAt: '2026-10-01T09:00:00.000Z',
}

const state = (over = {}) => ({
  data: request,
  loading: false,
  error: null,
  notFound: false,
  ...over,
})

const render = () =>
  renderWithProviders(<ContentsChurchRequestDetail churchId="c1" requestId="q1" />)

describe('ContentsChurchRequestDetail (S11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.useRequest.mockReturnValue(state())
  })

  it('shows the request with classification, message and contact preferences', () => {
    render()
    expect(m.useRequest).toHaveBeenCalledWith({ churchId: 'c1', requestId: 'q1' })
    expect(screen.getByRole('heading', { name: 'Prayer for family' })).toBeTruthy()
    expect(screen.getByText('Private')).toBeTruthy()
    expect(screen.getByText('member@example.org')).toBeTruthy()
    // Phone and availability were not supplied.
    expect(screen.getAllByText('Not supplied')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Back to Requests' }).getAttribute('href')).toBe(
      '/dashboard/churches/c1/requests',
    )
  })

  it('renders the message as plain text, never HTML', () => {
    const { container } = render()
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText(/<b>not bold<\/b>/)).toBeTruthy()
  })

  it('offers only the supplied contact value as an external link', () => {
    render()
    const email = screen.getByRole('link', { name: /Use supplied email/ })
    expect(email.getAttribute('href')).toBe('mailto:member%40example.org')
    expect(screen.queryByRole('link', { name: /Use supplied phone/ })).toBeNull()
  })

  it('puts the preferred phone first and strips formatting from tel links', () => {
    m.useRequest.mockReturnValue(
      state({
        data: { ...request, contactMethod: 'phone', phone: '+372 5555-0000' },
      }),
    )
    render()
    const links = screen.getAllByRole('link', { name: /Use supplied/ })
    expect(links.map((l) => l.textContent)).toEqual(['Use supplied phone', 'Use supplied email'])
    expect(links[0].getAttribute('href')).toBe('tel:+37255550000')
  })

  it('labels pastoral/meeting requests Restricted and falls back to the kind label', () => {
    m.useRequest.mockReturnValue(
      state({ data: { ...request, kind: 'meeting', subject: null, classification: null } }),
    )
    render()
    expect(screen.getByRole('heading', { name: 'Meeting request' })).toBeTruthy()
    expect(screen.getByText('Restricted')).toBeTruthy()
  })

  it('shows the same unavailable state for a missing or forbidden request', () => {
    m.useRequest.mockReturnValue(state({ data: undefined, notFound: true }))
    render()
    expect(screen.getByText('Request not available')).toBeTruthy()
    expect(screen.queryByText('Submitted message')).toBeNull()
  })

  it('has no reply, status or booking controls (D3)', () => {
    render()
    for (const name of [/reply/i, /status/i, /assign/i, /book/i]) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
