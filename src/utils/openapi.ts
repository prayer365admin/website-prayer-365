import {
  OpenAPIRegistry,
  OpenApiGeneratorV32,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi'
import type { RouteConfig } from '@asteasolutions/zod-to-openapi/dist/openapi-registry'
import { z } from 'zod'

/*
 * OpenAPI 3.1 registry (decision A10 / Task 8). A single shared registry that
 * routes register into using the SAME zod schemas they validate with.
 *
 * Bundling guard: Next.js may resolve `zod` to `next/dist/compiled/zod` for some
 * modules and `node_modules/zod` for others, producing two zod instances. Only
 * the instance `extendZodWithOpenApi` patched has the `.openapi` accessor; a
 * schema from the other instance throws "b.openapi is not a function" at build
 * time. Every schema entering the registry is therefore normalized through
 * `openApiSafe()`, which returns a plain-object schema when the source lacks
 * `.openapi`. This keeps GET /api/v1/openapi.json buildable in all bundlings.
 */

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface ZodOpenApiResponse {
  status: number
  description: string
  schema?: z.ZodType
  contentType?: string
}

export interface RegisterPathArgs {
  path: string
  method: Method
  auth?: boolean
  summary: string
  request?: {
    params?: Array<{ name: string; in: 'path' | 'query'; required?: boolean; schema: z.ZodType }>
    body?: z.ZodType
  }
  responses: ZodOpenApiResponse[]
}

/** Does the schema carry the `.openapi` accessor the generator needs? */
const hasOpenApi = (s: unknown) =>
  typeof (s as { openapi?: unknown } | null)?.openapi === 'function'

/**
 * OpenAPI path templating uses `{param}`, but route modules declare Next.js
 * style `:param`. Convert `:name` (not `::`) to `{name}` so Swagger UI can map
 * path parameters and substitute real ids — otherwise the spec publishes
 * `/admin/churches/:churchId/overview`, which Swagger cannot fill and the Try
 * it out call hits a placeholder id → backend 404 RESOURCE_NOT_FOUND.
 */
export const toOpenApiPath = (path: string) =>
  path.replace(/(^|[^:]):([A-Za-z_][A-Za-z0-9_]*)/g, '$1{$2}')

/**
 * RefIds become `#/components/schemas/<refId>` which JSON Pointer resolves by
 * splitting on `/`. Path braces/colons/slashes would break that, so refIds are
 * sanitized to `[A-Za-z0-9._-]` only.
 */
export const sanitizeRefId = (refId: string) => refId.replace(/[^A-Za-z0-9._-]/g, '_')

/**
 * Registry-safe schema. If the schema object is not from the extended zod
 * instance (or is a ZodEffects wrapper the generator can't embed directly),
 * fall back to a plain object schema so the spec still builds.
 */
const openApiSafe = (schema: z.ZodType): z.ZodType => {
  if (schema && hasOpenApi(schema)) return schema
  // Unbuildable / non-extended instance: describe as a free-form object.
  return z.record(z.string(), z.unknown())
}

export const registerPath = ({
  path: rawPath,
  method,
  auth = true,
  summary,
  request,
  responses,
}: RegisterPathArgs) => {
  const path = toOpenApiPath(rawPath)
  const opts = {
    path,
    method,
    summary,
    ...(auth ? { security: [{ bearerAuth: [] }] } : { security: [] }),
    ...(request?.params
      ? {
          parameters: request.params.map((p) => ({
            name: p.name,
            in: p.in,
            required: p.required ?? p.in === 'path',
            schema: registry.register(
              sanitizeRefId(`param-${path}-${method}-${p.name}`),
              openApiSafe(p.schema),
            ),
          })),
        }
      : {}),
    ...(request?.body
      ? {
          requestBody: {
            content: {
              'application/json': {
                schema: registry.register(
                  sanitizeRefId(`body-${path}-${method}`),
                  openApiSafe(request.body),
                ),
              },
            },
          },
        }
      : {}),
    responses: Object.fromEntries(
      responses.map((r) => [
        r.status,
        {
          description: r.description,
          ...(r.schema
            ? {
                content: {
                  [r.contentType ?? 'application/json']: {
                    schema: registry.register(
                      sanitizeRefId(`res-${path}-${method}-${r.status}`),
                      openApiSafe(r.schema),
                    ),
                  },
                },
              }
            : {}),
        },
      ]),
    ),
  }
  registry.registerPath(opts as unknown as RouteConfig)
}

export const openApiDocument = () => {
  const generator = new OpenApiGeneratorV32(registry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'PRAYER API',
      version: '1.0.0',
      description: 'PRAYER admin + mobile shared backend (SPEC sections 6-8).',
    },
    servers: [{ url: '/api/v1' }],
  })
}
