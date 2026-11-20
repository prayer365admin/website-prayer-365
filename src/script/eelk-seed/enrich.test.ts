import { describe, expect, it } from 'vitest'
import recorded from './__fixtures__/commons.json'
import { nameTokens } from './enrich'
import { pickPhotos, type CommonsPage } from './photos'

const pages = Object.values(
  (recorded as { query: { pages: Record<string, CommonsPage> } }).query.pages,
)

describe('pickPhotos', () => {
  it('keeps the real church photo', () => {
    const photos = pickPhotos(pages)
    expect(photos).toHaveLength(1)
    expect(photos[0].title).toBe('Ambla kirik 2012.jpg')
  })

  it('drops a map', () => {
    expect(pickPhotos(pages).some((photo) => photo.title.includes('kaart'))).toBe(false)
  })

  it('uses the 1280 px thumb, not the 4000 px original', () => {
    expect(pickPhotos(pages)[0].url).toContain('/thumb/')
  })

  it('keeps licence and author without html', () => {
    const photo = pickPhotos(pages)[0]
    expect(photo.license).toBe('CC BY-SA 4.0')
    expect(photo.author).toBe('Ivar Leidus')
  })

  it('keeps the commons file page as the source', () => {
    expect(pickPhotos(pages)[0].sourceUrl).toBe(
      'https://commons.wikimedia.org/wiki/File:Ambla_kirik_2012.jpg',
    )
  })

  it('never returns more than the limit', () => {
    expect(pickPhotos([...pages, ...pages], 3).length).toBeLessThanOrEqual(3)
  })
})

describe('nameTokens', () => {
  it('keeps the place and the church word, drops the liturgy words', () => {
    expect(nameTokens('TARTU Peetri kogudus')).toEqual(['tartu', 'peetri'])
  })

  it('drops "püha" so the saint name stays distinctive', () => {
    expect(nameTokens('KIHELKONNA Püha Mihkli kogudus')).toEqual(['kihelkonna', 'mihkli'])
  })
})
