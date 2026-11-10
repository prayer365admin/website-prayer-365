import { describe, expect, it, vi } from 'vitest'
import Page from './page'

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }))

vi.mock('next/navigation', () => ({ redirect }))

describe('/terms', () => {
  it('forwards the footer link to the Terms section of /privacy', () => {
    Page()

    expect(redirect).toHaveBeenCalledWith('/privacy#terms')
  })
})
