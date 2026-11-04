// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HANDLERS } from './consumer'
import { SUPPORTED_KINDS } from '@/controller/job-dispatch'

/*
 * Guard against the "producer without processor" gap (notification.send): the
 * dispatcher allow-list, the consumer handler map, and the kinds actually
 * enqueued by providers must agree.
 */

const providersDir = path.resolve(__dirname, '../providers')

/** Job kinds with no consumer yet. Keep this list short and intentional. */
const KNOWN_UNPROCESSED: string[] = []

const providerKinds = () => {
  const kinds = new Set<string>()
  // Job kinds are always `<domain>.<action>`; requiring the dot avoids unrelated
  // `kind:` literals such as VoiceProviderError's 'retryable'.
  const pattern = /kind:\s*'([a-z]+\.[a-z._]+)'/g
  for (const file of fs.readdirSync(providersDir)) {
    if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue
    const source = fs.readFileSync(path.join(providersDir, file), 'utf8')
    let match = pattern.exec(source)
    while (match) {
      kinds.add(match[1])
      match = pattern.exec(source)
    }
    pattern.lastIndex = 0
  }
  return kinds
}

describe('job kind wiring', () => {
  it('keeps the dispatcher allow-list and the consumer handler map in sync', () => {
    expect(Array.from(SUPPORTED_KINDS).sort()).toEqual(Object.keys(HANDLERS).sort())
  })

  it('fails when a provider enqueues a kind nothing processes', () => {
    const unhandled = Array.from(providerKinds()).filter(
      (kind) => !SUPPORTED_KINDS.includes(kind as (typeof SUPPORTED_KINDS)[number]),
    )
    expect(unhandled.sort()).toEqual([...KNOWN_UNPROCESSED].sort())
  })
})
