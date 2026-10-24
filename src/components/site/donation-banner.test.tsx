import { DonationBanner } from '@/components/site/donation-banner'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('DonationBanner', () => {
  it('renders the body, the CTA label and the target, with no heading by default', () => {
    render(
      <DonationBanner
        body="Support this parish."
        ctaLabel="Support This Parish"
        href="/donate?church=hope-church"
      />,
    )

    expect(screen.getByText('Support this parish.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Support This Parish' }).getAttribute('href')).toBe(
      '/donate?church=hope-church',
    )
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('renders the eyebrow and title when given', () => {
    render(
      <DonationBanner
        body="Body copy"
        ctaLabel="Giving & Stewardship"
        eyebrow="Donations / Stewardship"
        href="/donate"
        title="Support God's Work in the Community"
      />,
    )

    expect(
      screen.getByRole('heading', { name: "Support God's Work in the Community" }),
    ).toBeTruthy()
    expect(screen.getByText('Donations / Stewardship')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Giving & Stewardship' }).getAttribute('href')).toBe(
      '/donate',
    )
  })
})
