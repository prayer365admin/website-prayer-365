import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'

const { useChurchPastorsMock } = vi.hoisted(() => ({ useChurchPastorsMock: vi.fn() }))

vi.mock('@/hooks/data/pastor', () => ({ useChurchPastors: useChurchPastorsMock }))

import SelectPastor from './index'

describe('SelectPastor', () => {
  beforeEach(() => {
    useChurchPastorsMock.mockReset()
    useChurchPastorsMock.mockReturnValue({
      data: [{ id: 'p1', name: 'Pastor Bob' }],
      loading: false,
    })
  })

  it('loads the church pastors into the select options', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SelectPastor name="pastor_id" label="Pastor" churchId="c1" />)

    expect(useChurchPastorsMock).toHaveBeenCalledWith('c1')
    await user.click(await screen.findByRole('combobox'))
    expect(await screen.findByText('Pastor Bob')).toBeTruthy()
  })
})
