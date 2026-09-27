import { Prisma, RequestKind } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { writeAudit } from '@/utils/audit'
import { ParsedListQuery } from '@/utils/pagination'
import { RequestOutput, RequestListSummary } from '@/models/request'

/*
 * Request data adapter (Task 28). Sensitive filter: a caller WITHOUT the
 * church-local `prayer_private_request:read` grant never sees a PRIVATE row.
 * The SAME where is used for count and rows so hidden rows do not leak into
 * `total`. Detail lookups that miss (out of scope or private-to-caller) return
 * null so the controller maps them to 404 (existence hidden).
 */

const KIND_TO_DB: Record<string, RequestKind> = {
  prayer: 'PRAYER',
  pastoral: 'PASTORAL',
  meeting: 'MEETING',
}

const KIND_FROM_DB: Record<RequestKind, string> = {
  PRAYER: 'prayer',
  PASTORAL: 'pastoral',
  MEETING: 'meeting',
}

const fromClassification = (c: string | null): string | null => (c ? c.toLowerCase() : null)

const toIds = (churchIds: Set<string>) => Array.from(churchIds)

/** Rows visible to the caller: everything, or only non-PRIVATE (incl. null). */
const prismaPrivateFilter = (canReadPrivate: boolean): Prisma.RequestWhereInput =>
  canReadPrivate ? {} : { OR: [{ classification: null }, { classification: { not: 'PRIVATE' } }] }

const listWhere = ({
  churchIds,
  kind,
  canReadPrivate,
}: {
  churchIds: Set<string>
  kind?: string
  canReadPrivate: boolean
}): Prisma.RequestWhereInput => ({
  church_id: { in: toIds(churchIds) },
  ...(kind ? { kind: KIND_TO_DB[kind] } : {}),
  ...prismaPrivateFilter(canReadPrivate),
})

/** Paginated authorized summaries; count and rows share the same scoped filter. */
export const GET_REQUESTS = async ({
  churchIds,
  kind,
  canReadPrivate,
  query,
}: {
  churchIds: Set<string>
  kind?: string
  canReadPrivate: boolean
  query: ParsedListQuery
}): Promise<{ result: RequestListSummary[]; total: number }> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return { result: [], total: 0 }
  const where = listWhere({ churchIds, kind, canReadPrivate })
  const orderBy: Prisma.RequestOrderByWithRelationInput[] = [
    { created_at: query.order_direction },
    { id: 'asc' },
  ]
  const [total, rows] = await db.$transaction([
    db.request.count({ where }),
    db.request.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy,
    }),
  ])
  return {
    total,
    result: rows.map((r) => ({
      id: r.id,
      kind: KIND_FROM_DB[r.kind],
      subject: r.subject,
      classification: fromClassification(r.classification),
      contactMethod: r.contact_method,
      createdAt: r.created_at.toISOString(),
    })),
  }
}

/**
 * Single authorized request. Returns null when out of scope or private-to-
 * caller (indistinguishable, so callers cannot probe existence). On success
 * writes a minimal access-audit line with NO message/contact/classification.
 */
export const GET_REQUEST = async ({
  churchIds,
  requestId,
  canReadPrivate,
  actorId,
  traceId,
}: {
  churchIds: Set<string>
  requestId: string
  canReadPrivate: boolean
  actorId?: string | null
  traceId: string
}): Promise<RequestOutput | null> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return null
  const row = await db.request.findFirst({
    where: { id: requestId, ...listWhere({ churchIds, canReadPrivate }) },
  })
  if (!row) return null
  // Access-audit on the sensitive read. writeAudit never accepts sensitive
  // payloads, so message/contacts/classification cannot leak to audit/logs.
  await writeAudit((data) => db.auditLog.create({ data }), {
    actorId,
    churchId: row.church_id,
    action: 'request.read',
    resourceType: 'request',
    resourceId: row.id,
    outcome: 'success',
    requestId: traceId,
  })
  return {
    id: row.id,
    kind: KIND_FROM_DB[row.kind],
    subject: row.subject,
    message: row.message,
    classification: fromClassification(row.classification),
    contactMethod: row.contact_method,
    phone: row.phone,
    email: row.email,
    availability: row.availability,
    createdAt: row.created_at.toISOString(),
  }
}
