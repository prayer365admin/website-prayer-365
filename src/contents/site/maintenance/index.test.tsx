import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ContentsSiteMaintenance from '.'

describe('ContentsSiteMaintenance', () => {
  it('announces the launch in English and offers a reload link', () => {
    renderWithProviders(<ContentsSiteMaintenance locale="en" />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Something new is coming')
    expect(screen.getByText('Coming soon')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Check again' }).getAttribute('href')).toBe('/')
  })

  it('renders the Estonian copy for the et locale', () => {
    renderWithProviders(<ContentsSiteMaintenance locale="et" />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Midagi uut on tulemas')
    expect(screen.getByRole('link', { name: 'Vaata uuesti' })).toBeTruthy()
  })
})
