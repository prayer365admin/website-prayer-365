import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import EventEditor from './editor'

const stored = {
  id: 'e1',
  churchId: 'c1',
  category: 'SERVICE' as const,
  title: 'Sunday service',
  description: 'Weekly',
  startsAt: '2026-02-15T08:00:00.000Z',
  location: 'Main hall',
  registrationUrl: null,
  languageCode: 'et',
  version: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const setup = (props: Partial<React.ComponentProps<typeof EventEditor>> = {}) => {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  renderWithProviders(
    <EventEditor
      timezone="Europe/Tallinn"
      languageCodes={['et', 'en']}
      open
      afterClose={vi.fn()}
      loading={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return onSubmit
}

describe('EventEditor', () => {
  it('shows timezone and reopens stored UTC as church-local time', () => {
    setup({ event: stored })
    expect(screen.getByText('Europe/Tallinn')).toBeTruthy()
    expect(screen.getByText(/UTC\+02:00/)).toBeTruthy()
    expect((screen.getByDisplayValue('2026-02-15 10:00') as HTMLInputElement).value).toBe(
      '2026-02-15 10:00',
    )
  })

  it('submits edit with explicit offset and current version', async () => {
    const onSubmit = setup({ event: stored })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Sunday service',
      startsAt: '2026-02-15T10:00:00+02:00',
      version: 4,
      languageCode: 'et',
      registrationUrl: null,
    })
  })

  it('rejects non-https registration link and keeps input', async () => {
    const onSubmit = setup({ event: { ...stored, registrationUrl: 'http://x.org' } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText(/https only/)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Sunday service')).toBeTruthy()
  })

  it('rejects nonexistent DST local time', async () => {
    const onSubmit = setup({ event: { ...stored, startsAt: '2026-03-29T00:30:00.000Z' } })
    // 00:30Z on 2026-03-29 is 02:30 local (valid); move to the gap via text entry
    const input = screen.getByDisplayValue('2026-03-29 02:30')
    const user = userEvent.setup()
    await user.clear(input)
    await user.type(input, '2026-03-29 03:30{Enter}')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText(/does not exist/)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('create payload omits version', async () => {
    const onSubmit = setup()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Title'), 'Bible night')
    await user.type(screen.getByLabelText('Location'), 'Room 2')
    await user.click(screen.getByLabelText('Date and time'))
    await user.type(screen.getByLabelText('Date and time'), '2026-02-15 18:00{Enter}')
    await user.click(screen.getByRole('button', { name: 'Create event' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.startsAt).toBe('2026-02-15T18:00:00+02:00')
    expect('version' in payload).toBe(false)
  })

  it('submits edit with custom ctaLabel', async () => {
    const onSubmit = setup({ event: { ...stored, ctaLabel: 'RSVP Fellowship' } })
    expect(screen.getByDisplayValue('RSVP Fellowship')).toBeTruthy()
    const ctaInput = screen.getByLabelText(/Action button label/i)
    const user = userEvent.setup()
    await user.clear(ctaInput)
    await user.type(ctaInput, 'Volunteer Care')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      ctaLabel: 'Volunteer Care',
    })
  })
})
