import { useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GlobalProvider from './index'

/**
 * Regression: the QueryClient used to be built in the render body, so every
 * navigation (a new `children` element re-renders this component) replaced it and
 * threw the whole cache away — every page then re-fetched before it could paint.
 */

const captureClients: unknown[] = []

const Probe = ({ label }: { label: string }) => {
  const client = useQueryClient()
  captureClients.push(client)
  return (
    <span data-testid={`probe-${label}`}>{String(client.getQueryCache().getAll().length)}</span>
  )
}

describe('GlobalProvider', () => {
  it('keeps one QueryClient instance across re-renders (navigation)', () => {
    captureClients.length = 0

    const { rerender } = render(
      <GlobalProvider>
        <Probe label="first" />
      </GlobalProvider>,
    )
    rerender(
      <GlobalProvider>
        <Probe label="second" />
      </GlobalProvider>,
    )

    expect(screen.getByTestId('probe-second')).toBeTruthy()
    expect(captureClients).toHaveLength(2)
    // Same instance = the cache survives the navigation.
    expect(captureClients[1]).toBe(captureClients[0])
  })

  it('still holds data that was cached before the re-render', () => {
    captureClients.length = 0

    const { rerender } = render(
      <GlobalProvider>
        <Probe label="first" />
      </GlobalProvider>,
    )
    const client = captureClients[0] as { setQueryData: (k: string[], v: unknown) => void }
    client.setQueryData(['probe'], 'cached-value')

    rerender(
      <GlobalProvider>
        <Probe label="second" />
      </GlobalProvider>,
    )

    expect(screen.getByTestId('probe-second').textContent).toBe('1')
  })
})
