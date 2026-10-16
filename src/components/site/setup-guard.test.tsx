import { axiosMock, renderWithProviders, replaceMock, sessionMock } from '@/test/frontend/render'
import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SetupGuard from './setup-guard'

const KEY = 'prayer365.setupProgress.u1'
const progress = (completed: boolean) => ({
  churchStepDone: completed,
  localeStepDone: completed,
  completed,
})

describe('SetupGuard (WB-15 browser record)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } } })
  })

  it('clean browser: asks the account, records the answer, sends unfinished setup to /customer/setup', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: progress(false) } })
    renderWithProviders(<SetupGuard />)

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/customer/setup'))
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/me/setup-progress')
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual(progress(false))
  })

  it('clean browser with a completed account: records it and stays', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: progress(true) } })
    renderWithProviders(<SetupGuard />)

    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull())
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('browser already recorded a completed setup: no request', () => {
    localStorage.setItem(KEY, JSON.stringify(progress(true)))
    renderWithProviders(<SetupGuard />)

    expect(axiosMock.get).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
