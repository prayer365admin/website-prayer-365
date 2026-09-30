import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MainNotification from './index'

describe('MainNotification', () => {
  it('fires a success notification', async () => {
    MainNotification({ type: 'success', entity: 'user', action: 'created' })
    expect(await screen.findByText('Success!')).toBeTruthy()
  })

  it('fires an error notification', async () => {
    MainNotification({ type: 'error', entity: 'user', action: 'deleted' })
    expect(await screen.findByText('Error!')).toBeTruthy()
  })
})
