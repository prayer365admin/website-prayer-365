import { describe, expect, it } from 'vitest'
import { plainTextToRichText, richTextToPlainText } from './rich-text-plain'

describe('prayer rich-text conversion', () => {
  it('converts formatted HTML into clean narration text', () => {
    expect(
      richTextToPlainText(
        '<h2>Be still</h2><p>Trust <strong>God</strong>.</p><ul><li>Amen</li></ul>',
      ),
    ).toBe('Be still\nTrust God.\n• Amen')
  })

  it('escapes uploaded plain text before creating paragraphs', () => {
    expect(plainTextToRichText('Be <still> & pray.\nAmen.')).toBe(
      '<p>Be &lt;still&gt; &amp; pray.<br>Amen.</p>',
    )
  })
})
