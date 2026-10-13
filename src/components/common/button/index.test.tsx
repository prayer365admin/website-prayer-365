import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SiteButton from '.'

describe('SiteButton', () => {
  it('is a plain button by default (never submits a form by accident)', () => {
    render(<SiteButton>Go</SiteButton>)

    expect(screen.getByRole('button', { name: 'Go' }).getAttribute('type')).toBe('button')
  })

  it.each([
    ['lg', 'h-14'],
    ['md', 'h-12'],
    ['sm', 'h-10'],
    ['xs', 'h-8'],
  ] as const)('size %s is %s tall', (size, height) => {
    render(<SiteButton size={size}>Go</SiteButton>)

    expect(screen.getByRole('button').className).toContain(height)
  })

  it('desktopSize switches size from the md breakpoint up', () => {
    render(
      <SiteButton desktopSize="lg" size="md">
        Go
      </SiteButton>,
    )
    const cls = screen.getByRole('button').className

    expect(cls).toContain('h-12')
    expect(cls).toContain('md:h-14')
  })

  it('places the icon at the end when asked', () => {
    render(
      <SiteButton icon={<span data-testid="icon" />} iconPlacement="end">
        Go
      </SiteButton>,
    )

    expect(screen.getByRole('button').lastElementChild).toBe(screen.getByTestId('icon'))
  })

  it('loading disables the button, marks it busy and blocks clicks', async () => {
    const onClick = vi.fn()
    render(
      <SiteButton loading onClick={onClick}>
        Go
      </SiteButton>,
    )
    const button = screen.getByRole('button')
    await userEvent.click(button)

    expect(button).toHaveProperty('disabled', true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn()
    render(
      <SiteButton onClick={onClick} variant="outlined">
        Go
      </SiteButton>,
    )
    await userEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
