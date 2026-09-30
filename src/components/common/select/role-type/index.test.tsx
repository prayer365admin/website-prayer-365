import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SelectRoleStatus from './index'

describe('SelectRoleStatus', () => {
  it('renders a select with the role-status placeholder', () => {
    render(<SelectRoleStatus name="type" label="Type" />)
    expect(screen.getByText('Select role status')).toBeTruthy()
  })
})
