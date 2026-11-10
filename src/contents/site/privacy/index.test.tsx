import { SITE_MESSAGES } from '@/i18n/messages'
import { renderWithProviders } from '@/test/frontend/render'
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ContentsSitePrivacy from '.'
import { POLICY_DOCUMENTS } from './data'

const headingText = (level: 1 | 2) =>
  screen.getAllByRole('heading', { level }).map((heading) => heading.textContent)

describe('ContentsSitePrivacy', () => {
  it('renders the three documents in order with their page anchors', () => {
    renderWithProviders(<ContentsSitePrivacy locale="en" />)

    expect(headingText(1)).toEqual(['Privacy & Policies'])
    expect(headingText(2)).toEqual(['Privacy Policy', 'Terms & Conditions', 'Cookie Policy'])

    POLICY_DOCUMENTS.forEach((policyDocument) => {
      expect(globalThis.document.getElementById(policyDocument.id)).toBeTruthy()
    })
  })

  it('keeps the PDF section numbering visible', () => {
    const { container } = renderWithProviders(<ContentsSitePrivacy locale="en" />)
    const sectionTitles = Array.from(container.querySelectorAll('h3')).map(
      (heading) => heading.textContent,
    )

    expect(sectionTitles).toContain('1. Information We Collect')
    expect(sectionTitles).toContain('15. Contact Us')
    expect(sectionTitles).toContain('22. Contact Us')
    expect(sectionTitles).toContain('6. Changes and Contact')
    // 15 privacy + 22 terms + 6 cookie sections, no duplicates.
    expect(sectionTitles).toHaveLength(43)
  })

  it('links each anchor chip at its own document', () => {
    renderWithProviders(<ContentsSitePrivacy locale="en" />)
    const nav = screen.getByRole('navigation', { name: 'Documents on this page' })

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Privacy Policy', '#privacy'],
      ['Terms & Conditions', '#terms'],
      ['Cookie Policy', '#cookies'],
    ])
  })

  it('renders the copy in the requested locale', () => {
    renderWithProviders(<ContentsSitePrivacy locale="et" />)

    expect(headingText(1)).toEqual([SITE_MESSAGES.et.policiesTitle])
    expect(headingText(1)).not.toEqual([SITE_MESSAGES.en.policiesTitle])
  })
})
