import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SacramentalPrivacy from './sacramental-privacy'

describe('SacramentalPrivacy', () => {
  it('shows privacy information with export and deletion actions unavailable', () => {
    render(<SacramentalPrivacy />)

    expect(screen.getByRole('heading', { name: /Sacramental Privacy/ })).toBeTruthy()
    for (const name of ['PDF Archive', /Request Account Deletion/]) {
      expect(screen.getByRole('button', { name })).toHaveProperty('disabled', true)
    }
    expect(screen.queryByRole('button', { name: 'JSON Data' })).toBeNull()
  })
})
