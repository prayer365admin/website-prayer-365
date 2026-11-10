import { describe, expect, it } from 'vitest'
import {
  plainTextToRichText,
  prayerTextForDisplay,
  richTextFirstSentence,
  richTextToPlainText,
} from './rich-text-plain'

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

  it('extracts one complete sentence from formatted prayer text', () => {
    expect(
      richTextFirstSentence(
        '<p>Be still and know that grace is near.</p><p>This sentence is not included.</p>',
      ),
    ).toBe('Be still and know that grace is near.')
  })

  it('normalizes prayer display text and removes ElevenLabs cues', () => {
    expect(
      prayerTextForDisplay('<p>[warm] Be <strong>still</strong>.</p><p>[pause] Amen.</p>'),
    ).toBe('Be still. Amen.')
  })

  it('decodes double-escaped entities so imported non-breaking spaces become real spaces', () => {
    expect(prayerTextForDisplay('Miks&amp;nbsp;kogudus?&amp;nbsp;Aeg-ajalt öeldakse.')).toBe(
      'Miks kogudus? Aeg-ajalt öeldakse.',
    )
  })

  it('leaves unknown entities untouched', () => {
    expect(richTextToPlainText('Love &slotis; grace')).toBe('Love &slotis; grace')
  })
})
