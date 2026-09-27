// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
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

  it('registerPath supports public (no auth), request body, and converts :param → {param}', () => {
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
    // :churchId must be published as {churchId} so Swagger can map the path param.
    const normalized = '/churches/{churchId}/requests'
    expect(doc.paths[normalized]).toBeDefined()
    expect(doc.paths[path]).toBeUndefined()
    const op = doc.paths[normalized]?.post as {
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

  it('every registerPath route module is imported by openapi-registrations (no omitted endpoints)', () => {
    const apiDir = join(process.cwd(), 'src', 'app', 'api', 'v1')
    const regRead = readFileSync(
      join(process.cwd(), 'src', 'utils', 'openapi-registrations.ts'),
      'utf8',
    )

    const routeBases: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/^route\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test')) {
          const src = readFileSync(full, 'utf8')
          if (src.includes('registerPath(')) {
            // import specifier is the path minus the `src/` prefix, without the file name
            routeBases.push(apiDir ? full.slice(full.indexOf('src/')) : full)
          }
        }
      }
    }
    walk(apiDir)

    const missing = routeBases
      .map((base) => `@/${base.replace(/^src\//, '').replace(/\.tsx?$/, '')}`)
      .filter((spec) => !regRead.includes(`'${spec}'`) && !regRead.includes(`"${spec}"`))

    expect(
      missing,
      `route modules not imported into OpenAPI registry:\n${missing.join('\n')}`,
    ).toEqual([])
  })
})
