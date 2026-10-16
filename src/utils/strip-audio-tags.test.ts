import { describe, expect, it } from 'vitest'
import { stripAudioTags } from './strip-audio-tags'

describe('stripAudioTags', () => {
  it('removes tags anywhere and tidies the spacing they leave', () => {
    expect(stripAudioTags('[warm] Lord, hear our prayer.')).toBe('Lord, hear our prayer.')
    expect(stripAudioTags('Give us peace [thoughtful, reflective], O God [pause].')).toBe(
      'Give us peace, O God.',
    )
    expect(stripAudioTags('Amen [whispers]\n[softly] Go in peace.')).toBe('Amen\nGo in peace.')
  })

  it('leaves untagged text and unclosed brackets alone', () => {
    expect(stripAudioTags('Peace be with you.')).toBe('Peace be with you.')
    expect(stripAudioTags('Psalm 23 [line one\nline two]')).toBe('Psalm 23 [line one\nline two]')
  })
})
