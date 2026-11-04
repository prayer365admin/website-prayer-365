import { describe, expect, it, vi } from 'vitest'
import { confirmLifecycle, LIFECYCLE } from './lifecycle'

describe('lifecycle', () => {
  it('defines correct labels and effects for all actions', () => {
    expect(LIFECYCLE.approve.label).toBe('Approve')
    expect(LIFECYCLE.approve.effect).toBe(
      'The church becomes visible in the public app and can publish content.',
    )
    expect(LIFECYCLE.approve.danger).toBeUndefined()

    expect(LIFECYCLE.suspend.label).toBe('Suspend')
    expect(LIFECYCLE.suspend.effect).toBe(
      'The church keeps its data but stops being publicly available.',
    )
    expect(LIFECYCLE.suspend.danger).toBeUndefined()

    expect(LIFECYCLE.unsuspend.label).toBe('Unsuspend')
    expect(LIFECYCLE.unsuspend.effect).toBe(
      'The church becomes publicly available again and can publish content.',
    )
    expect(LIFECYCLE.unsuspend.danger).toBeUndefined()

    expect(LIFECYCLE.archive.label).toBe('Archive')
    expect(LIFECYCLE.archive.effect).toBe(
      'Archiving removes this church from the public app. Its historical data, records, and reports remain preserved in the dashboard.',
    )
    expect(LIFECYCLE.archive.danger).toBe(true)

    expect(LIFECYCLE.unarchive.label).toBe('Unarchive')
    expect(LIFECYCLE.unarchive.effect).toBe(
      'The church becomes active and visible again in the public app and dashboard.',
    )
    expect(LIFECYCLE.unarchive.danger).toBeUndefined()
  })

  it('calls modal.confirm with action details and invokes run with action and version on ok', async () => {
    const modal = { confirm: vi.fn() }
    const run = vi.fn().mockResolvedValue(undefined)
    const church = { name: 'Example Church', version: 2 }

    confirmLifecycle(modal, church, 'approve', run)

    expect(modal.confirm).toHaveBeenCalledTimes(1)
    const config = modal.confirm.mock.calls[0][0]
    expect(config.title).toBe('Approve Example Church?')
    expect(config.okText).toBe('Approve')
    expect(config.okButtonProps).toBeUndefined()

    // Trigger onOk
    await config.onOk()
    expect(run).toHaveBeenCalledWith({ action: 'approve', version: 2 })
  })

  it('configures danger button for archive action', async () => {
    const modal = { confirm: vi.fn() }
    const run = vi.fn().mockResolvedValue(undefined)
    const church = { name: 'Example Church', version: 5 }

    confirmLifecycle(modal, church, 'archive', run)

    expect(modal.confirm).toHaveBeenCalledTimes(1)
    const config = modal.confirm.mock.calls[0][0]
    expect(config.title).toBe('Archive Example Church?')
    expect(config.okText).toBe('Archive')
    expect(config.okButtonProps).toEqual({ danger: true })

    await config.onOk()
    expect(run).toHaveBeenCalledWith({ action: 'archive', version: 5 })
  })
})
