import { describe, expect, it } from 'vitest'
import { sanitizePrayerRichText } from './sanitize-prayer-rich-text'

describe('sanitizePrayerRichText', () => {
  it('keeps supported formatting and removes unsafe markup', () => {
    expect(
      sanitizePrayerRichText(
        '<p onclick="alert(1)">Pray <strong>today</strong>.</p><script>alert(1)</script><a href="https://example.com">Link</a>',
      ),
    ).toBe('<p>Pray <strong>today</strong>.</p>Link')
  })

  it('keeps the approved accent color and removes other colors', () => {
    expect(
      sanitizePrayerRichText(
        '<font color="#2f7ad2">Accent</font><span style="color:red"> unsafe</span>',
      ),
    ).toBe('<span style="color:#2f7ad2">Accent</span><span> unsafe</span>')
  })

  it('preserves stacked emphasis and accent formatting', () => {
    expect(
      sanitizePrayerRichText(
        '<strong><em><u><span style="color:#2f7ad2">Emphasized prayer</span></u></em></strong>',
      ),
    ).toBe('<strong><em><u><span style="color:#2f7ad2">Emphasized prayer</span></u></em></strong>')
  })

  it('preserves React Quill list semantics', () => {
    expect(
      sanitizePrayerRichText(
        '<ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>First</li><li data-list="ordered">Second</li></ol>',
      ),
    ).toBe('<ol><li data-list="bullet">First</li><li data-list="ordered">Second</li></ol>')
  })

  it('preserves the supported semantic heading hierarchy', () => {
    expect(sanitizePrayerRichText('<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4>')).toBe(
      '<h1>One</h1><h2>Two</h2><h3>Three</h3>Four',
    )
  })
})
