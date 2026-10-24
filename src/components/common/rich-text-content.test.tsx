import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RichTextContent, { normalizeRichTextWhitespace } from './rich-text-content'

describe('RichTextContent', () => {
  it('normalizes non-breaking spaces so formatted prayer text can wrap between words', () => {
    const html =
      '<p><span>truth\u00a0and\u00a0love.</span> <strong>Remain&nbsp;together.</strong> &#xA0;Amen.</p>'

    const { container } = render(<RichTextContent html={html} />)
    const paragraph = screen.getByText(/truth and love/).closest('p')!

    expect(paragraph.textContent).toBe('truth and love. Remain together. Amen.')
    expect(paragraph.textContent).not.toContain('\u00a0')
    expect(paragraph.querySelector('strong')?.textContent).toBe('Remain together.')
    expect(container.firstElementChild?.classList.contains('break-words')).toBe(true)
  })

  it('normalizes whitespace in legacy plain-text prayers too', () => {
    expect(normalizeRichTextWhitespace('truth\u00a0and&nbsp;love')).toBe('truth and love')
  })

  it('keeps editor paragraph and line breaks while normalizing word spaces', () => {
    const { container } = render(
      <RichTextContent
        html={'<p>First\u00a0line.</p><p>&nbsp;</p><p>Second\u00a0line.<br>Third line.</p>'}
      />,
    )
    const paragraphs = container.querySelectorAll('p')

    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[0]?.textContent).toBe('First line.')
    expect(paragraphs[1]?.querySelector('br')).toBeTruthy()
    expect(paragraphs[2]?.innerHTML).toBe('Second line.<br>Third line.')
  })
})
