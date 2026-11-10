import { describe, expect, it } from 'vitest'
import { parseServiceSentence } from './service-times'

/*
 * Fixtures are the real sentences captured from eelk.ee/inc.kogudused.php on
 * 2026-11-11, so this test does not need the network.
 */
describe('parseServiceSentence', () => {
  it('reads a plain Sunday time', () => {
    const result = parseServiceSentence('Jumalateenistus pühapäeviti 11.00')
    expect(result.times).toEqual([
      { weekday: 7, time: '11:00', label: 'pühapäeviti 11.00', language: 'et' },
    ])
    expect(result.flagged).toEqual([])
  })

  it('keeps the "only 1st and 3rd Sunday" qualifier in the label', () => {
    const result = parseServiceSentence('Jumalateenistus kuu 1. ja 3. pühapäeval 14.00')
    expect(result.times).toHaveLength(1)
    expect(result.times[0]).toMatchObject({ weekday: 7, time: '14:00' })
    expect(result.times[0].label).toContain('kuu 1. ja 3. pühapäeval')
  })

  it('carries one time across a list of weekdays', () => {
    const result = parseServiceSentence(
      'Jumalateenistus pühapäeviti 11.00, esmaspäeviti, teisipäeviti, kolmapäeviti 7.30',
    )
    expect(result.times.map((time) => [time.weekday, time.time])).toEqual([
      [7, '11:00'],
      [3, '07:30'],
    ])
  })

  it('splits languages when the sentence states them', () => {
    const result = parseServiceSentence(
      'Jumalateenistus pühapäeviti 12.00 rootsi keeles, 10.00 soome keeles, kuu 2. ja 4. pühapäeval 15.00 saksa keeles',
    )
    expect(result.times.map((time) => [time.time, time.language])).toEqual([
      ['12:00', 'sv'],
      ['10:00', 'fi'],
      ['15:00', 'de'],
    ])
  })

  it('flags a time with no weekday instead of inventing one', () => {
    const result = parseServiceSentence(
      'Jumalateenistus pühapäeviti 15.00, kord kuus 12.00 ja 15.00',
    )
    expect(result.times).toHaveLength(1)
    expect(result.flagged.join(' ')).toContain('kord kuus')
  })

  it('stops before the bank-account block', () => {
    const result = parseServiceSentence(
      'Jumalateenistus pühapäeviti 11.00Koguduse arvelduskontoEE872200221011350104 Swedbank',
    )
    expect(result.times).toHaveLength(1)
  })

  it('keeps a seasonal or venue qualifier as the label', () => {
    const result = parseServiceSentence(
      'Jumalateenistus pühapäeviti 11.00 toomkirikus, hommikupalvus reedeti 9.00 Jaani kirikus',
    )
    expect(result.times.map((time) => [time.weekday, time.time, time.label])).toEqual([
      [7, '11:00', 'pühapäeviti 11.00 toomkirikus'],
      [5, '09:00', 'hommikupalvus reedeti 9.00 Jaani kirikus'],
    ])
  })
})
