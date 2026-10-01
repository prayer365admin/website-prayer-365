import { renderHook, act } from '@testing-library/react'
import { useMainNotification } from './notification'
import { App } from 'antd'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('antd', () => {
  const mockNotification = {
    success: vi.fn(),
    error: vi.fn(),
  }
  return {
    App: {
      useApp: vi.fn(() => ({ notification: mockNotification })),
    },
  }
})

describe('useMainNotification', () => {
  let mockNotification: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockNotification = App.useApp().notification as unknown as {
      success: ReturnType<typeof vi.fn>
      error: ReturnType<typeof vi.fn>
    }
    vi.clearAllMocks()
  })

  it('calls notification.success with correct title instead of message', () => {
    const { result } = renderHook(() => useMainNotification())

    act(() => {
      result.current({ type: 'success', entity: 'User', action: 'Created' })
    })

    expect(mockNotification.success).toHaveBeenCalledTimes(1)
    expect(mockNotification.success).toHaveBeenCalledWith({
      title: 'Success!',
      description: 'Congratulations! user has been successfully created!',
    })
  })

  it('calls notification.error with correct title instead of message', () => {
    const { result } = renderHook(() => useMainNotification())

    act(() => {
      result.current({ type: 'error', entity: 'Post', action: 'Deleted' })
    })

    expect(mockNotification.error).toHaveBeenCalledTimes(1)
    expect(mockNotification.error).toHaveBeenCalledWith({
      title: 'Error!',
      description:
        'Oops! Something went wrong with post. Unable to deleted at this time. Please try again later or contact support if the issue persists',
    })
  })
})
