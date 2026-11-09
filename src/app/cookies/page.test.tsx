import { describe, expect, it, vi } from 'vitest'
import Page from './page'

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }))

vi.mock('next/navigation', () => ({ redirect }))

describe('/cookies', () => {
  it('forwards to the Cookie Policy section of /privacy', () => {
    Page()

    expect(redirect).toHaveBeenCalledWith('/privacy#cookies')
  })
})
