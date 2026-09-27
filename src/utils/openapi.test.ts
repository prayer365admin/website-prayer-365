import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { openApiDocument, registerPath } from './openapi'

type Doc = {
  openapi: string
  info: { title: string }
  paths: Record<string, Record<string, unknown>>
  components?: { schemas?: Record<string, unknown> }
}

/** Assert every $ref resolves to a real component key (JSON Pointer-safe). */
const assertRefsResolve = (doc: Doc) => {
  const schemas = doc.components?.schemas ?? {}
  const refs: string[] = []
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (typeof o.$ref === 'string') refs.push(o.$ref)
      Object.values(o).forEach(walk)
    }
  }
  walk(doc)
  for (const ref of refs) {
    const key = ref.split('/').pop()!
    expect(Object.prototype.hasOwnProperty.call(schemas, key), `missing schema for ${ref}`).toBe(
      true,
    )
  }
  expect(refs.length).toBeGreaterThan(0)
}

describe('openapi', () => {
  it('generates a valid 3.1 document with info', () => {
    const doc = openApiDocument() as unknown as Doc
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.title).toBe('PRAYER API')
    expect(doc.paths).toBeDefined()
  })

  it('registerPath lands the path with a 200 schema and bearer security', () => {
    const path = '/admin/me'
    registerPath({
      path,
      method: 'get',
      summary: 'me',
      responses: [{ status: 200, description: 'ok', schema: z.object({ id: z.string() }) }],
    })
    const doc = openApiDocument() as unknown as Doc
    const op = doc.paths[path]
    expect(op).toBeDefined()
    const entry = op?.get as {
      security?: Array<Record<string, string[]>>
      responses: Record<string, unknown>
    }
    expect(entry.security).toEqual([{ bearerAuth: [] }])
    expect(entry.responses['200']).toBeDefined()
  })

  it('registerPath supports public (no auth) and request body', () => {
    const path = '/churches/:churchId/requests'
    registerPath({
      path,
      method: 'post',
      auth: false,
      summary: 'submit request',
      request: { body: z.object({ kind: z.enum(['prayer', 'pastoral', 'meeting']) }) },
      responses: [{ status: 202, description: 'accepted', schema: z.object({ id: z.string() }) }],
    })
    const doc = openApiDocument() as unknown as Doc
    const op = doc.paths[path]?.post as {
      security: Array<Record<string, string[]>>
      requestBody?: unknown
      responses?: unknown
    }
    expect(op.security).toEqual([])
    expect(op.requestBody).toBeDefined()
  })

  it('produces only resolvable $refs (no JSON Pointer breakage from path slashes)', () => {
    const doc = openApiDocument() as unknown as Doc
    assertRefsResolve(doc)
  })
})
