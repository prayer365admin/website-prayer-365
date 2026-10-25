import { describe, expect, it } from 'vitest'

import { findDemoProblems } from './seed-verify-rules'
import type { DemoReadiness } from './seed-verify-rules'

const ready = (): DemoReadiness => ({
  churches: [
    {
      name: 'St. Johns',
      coverUrl: 'https://bucket.s3.eu-north-1.amazonaws.com/demo/image/a.jpg',
      galleryUrls: ['https://bucket/demo/image/a.jpg', 'https://bucket/demo/image/b.jpg'],
      serviceTimes: 3,
      events: 2,
      announcements: 1,
      pastors: 2,
    },
  ],
  prayers: [
    {
      church: 'St. Johns',
      title: 'Peace',
      published: true,
      audioStatus: 'APPROVED',
      audioUrl: 'https://bucket.s3.eu-north-1.amazonaws.com/demo/audio/a.mp3',
    },
  ],
  expectations: [{ name: 'St. Johns', prayerTitles: ['Peace'], galleryCount: 2 }],
  objectStatus: {},
})

describe('findDemoProblems', () => {
  it('passes a fully seeded demo', () => {
    expect(findDemoProblems(ready())).toEqual([])
  })

  it('reports the seed bug that shipped: a published prayer with no audio row', () => {
    const data = ready()
    data.prayers[0] = { ...data.prayers[0], audioStatus: null, audioUrl: null }
    expect(findDemoProblems(data)).toEqual([
      'St. Johns / Peace: audio status NONE',
      'St. Johns / Peace: no audio URL',
    ])
  })

  it('reports a relative audio URL (unplayable in the mobile app)', () => {
    const data = ready()
    data.prayers[0] = { ...data.prayers[0], audioUrl: '/audio/peace.mp3' }
    expect(findDemoProblems(data)).toEqual([
      'St. Johns / Peace: audio URL is not absolute (/audio/peace.mp3)',
    ])
  })

  it('reports a prayer that the seed never created', () => {
    const data = ready()
    data.expectations[0].prayerTitles.push('Vespers')
    expect(findDemoProblems(data)).toEqual([
      'St. Johns / Vespers: prayer missing from the database',
    ])
  })

  it('reports a missing church, cover, gallery, staff and service times', () => {
    const data = ready()
    data.churches[0] = {
      ...data.churches[0],
      coverUrl: null,
      galleryUrls: [null],
      serviceTimes: 0,
      pastors: 0,
    }
    expect(findDemoProblems(data)).toEqual([
      'St. Johns: no cover image',
      'St. Johns: gallery has 1/2 images',
      'St. Johns: a gallery item has no image URL',
      'St. Johns: no service times',
      'St. Johns: no pastoral staff',
    ])

    const gone = ready()
    gone.churches = []
    expect(findDemoProblems(gone)).toEqual(['church missing from the database: St. Johns'])
  })

  it('reports media objects that 404 in the active bucket', () => {
    const data = ready()
    data.objectStatus = { 'demo/audio/a.mp3': true, 'demo/audio/b.mp3': false }
    expect(findDemoProblems(data)).toEqual(['media object missing in the bucket: demo/audio/b.mp3'])
  })

  it('reports an unpublished prayer', () => {
    const data = ready()
    data.prayers[0] = { ...data.prayers[0], published: false }
    expect(findDemoProblems(data)).toEqual(['St. Johns / Peace: not published'])
  })
})
