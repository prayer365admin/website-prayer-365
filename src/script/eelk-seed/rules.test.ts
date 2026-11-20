import { describe, expect, it } from 'vitest'
import {
  contactsFor,
  DEANERY_ALIASES,
  deaneryNodeName,
  EXISTING_SLUG_BY_REG_CODE,
  NO_EELK_ROW_SLUGS,
  phonesFrom,
  splitAddress,
  titleCaseName,
} from './rules'

describe('titleCaseName', () => {
  it('turns the shouty place name into Title Case', () => {
    expect(titleCaseName('AEGVIIDU Aleksandri kogudus')).toBe('Aegviidu Aleksandri kogudus')
  })

  it('keeps the hyphen and the capital after it', () => {
    expect(titleCaseName('TARTU Ülikooli-Jaani kogudus')).toBe('Tartu Ülikooli-Jaani kogudus')
  })
})

describe('splitAddress', () => {
  it('splits the common four-part shape', () => {
    expect(splitAddress('Mäe 2, Aegviidu, Anija vald, 74501 Harjumaa')).toEqual({
      line1: 'Mäe 2',
      city: 'Aegviidu',
      postalCode: '74501',
      county: 'Harjumaa',
    })
  })

  it('handles a village in the city slot', () => {
    expect(splitAddress('Koolimaja, Tiirimetsa küla, Saaremaa vald, 93223 Saaremaa')).toEqual({
      line1: 'Koolimaja',
      city: 'Tiirimetsa küla',
      postalCode: '93223',
      county: 'Saaremaa',
    })
  })

  it('keeps a line without a postal code usable', () => {
    expect(splitAddress('Kiriku plats 3, Tallinn')).toEqual({
      line1: 'Kiriku plats 3',
      city: 'Tallinn',
      postalCode: null,
      county: null,
    })
  })

  it('takes the city from the second comma part, not the municipality', () => {
    expect(splitAddress('Lihula mnt 12-5, Audru, Pärnu linn, 88301 Pärnumaa').city).toBe('Audru')
  })
})

describe('phonesFrom', () => {
  it('joins numbers and drops the person names', () => {
    expect(phonesFrom('tel 528 1628 (Tiina Lõugas), 5647 1859 (Tõnu Linnasmäe)')).toEqual([
      '528 1628',
      '5647 1859',
    ])
  })

  it('keeps the email out of the phone list', () => {
    expect(phonesFrom('tel 525 4959 (Raigo Ojamets), alatskivi@eelk.ee')).toEqual(['525 4959'])
  })

  it('builds the contacts object with both fields', () => {
    expect(
      contactsFor({
        order: 1,
        regCode: '80211219',
        name: 'AEGVIIDU Aleksandri kogudus',
        deanery: 'Järva praostkond',
        addressLine: null,
        churchAddressLine: null,
        phoneLine: 'tel 528 1628 (Tiina Lõugas), aegviidu@eelk.ee',
        email: 'aegviidu@eelk.ee',
        website: null,
        socialLinks: [],
        serviceSentence: '',
      }),
    ).toEqual({ email: 'aegviidu@eelk.ee', phone: '528 1628' })
  })
})

describe('deanery mapping', () => {
  it('reuses the English node that exists', () => {
    expect(deaneryNodeName('Lääne praostkond')).toBe('Lääne Deanery')
  })

  it('maps the genitive Tallinna form too', () => {
    expect(deaneryNodeName('Tallinna praostkond')).toBe('Tallinn Deanery')
  })

  it('leaves a new praostkond in Estonian', () => {
    expect(DEANERY_ALIASES['Järva praostkond']).toBeUndefined()
    expect(deaneryNodeName('Järva praostkond')).toBe('Järva praostkond')
  })
})

describe('existing church table', () => {
  it('maps 23 PROD churches to a reg code', () => {
    expect(Object.keys(EXISTING_SLUG_BY_REG_CODE)).toHaveLength(23)
  })

  it('names the church that has no row', () => {
    expect(NO_EELK_ROW_SLUGS).toEqual(['narva-alexanders-church'])
    expect(
      NO_EELK_ROW_SLUGS.every((slug) => !Object.values(EXISTING_SLUG_BY_REG_CODE).includes(slug)),
    ).toBe(true)
  })
})
