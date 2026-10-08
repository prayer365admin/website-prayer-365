import { Prisma, RequestKind } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { writeAudit } from '@/utils/audit'
import { ParsedListQuery } from '@/utils/pagination'
import { RequestOutput, RequestListSummary } from '@/models/request'

/*
 * Request data adapter (Task 28). Sensitive filter: a caller WITHOUT the
 * church-local `prayer_private_request:read` grant only sees STANDARD prayer
 * requests. PRIVATE rows and every pastoral/meeting row (always restricted,
 * F7RQ R2) stay hidden. The SAME where is used for count and rows so hidden
 * rows do not leak into `total`. Queries target the exact route church. Detail
 * lookups that miss (out of scope or private-to-caller) return null so the
 * controller maps them to 404 (existence hidden).
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

export const fromKind = (k: RequestKind): string => KIND_FROM_DB[k]

export const fromClassification = (c: string | null): string | null => (c ? c.toLowerCase() : null)

/**
 * Rows the caller may see. Shared with the church overview so its counts use
 * the same rule as the request list.
 */
export const requestVisibilityWhere = (canReadPrivate: boolean): Prisma.RequestWhereInput =>
  canReadPrivate
    ? {}
    : {
        kind: 'PRAYER',
        OR: [{ classification: null }, { classification: { not: 'PRIVATE' } }],
      }

const listWhere = ({
  churchId,
  kinds,
  canReadPrivate,
}: {
  churchId: string
  kinds?: string[]
  canReadPrivate: boolean
}): Prisma.RequestWhereInput => ({
  church_id: churchId,
  // AND keeps the kind filter and the visibility rule from overwriting each other.
  AND: [
    kinds?.length ? { kind: { in: kinds.map((k) => KIND_TO_DB[k]) } } : {},
    requestVisibilityWhere(canReadPrivate),
  ],
})

/** Paginated authorized summaries; count and rows share the same scoped filter. */
export const GET_REQUESTS = async ({
  churchId,
  kinds,
  canReadPrivate,
  query,
}: {
  churchId: string
  kinds?: string[]
  canReadPrivate: boolean
  query: ParsedListQuery
}): Promise<{ result: RequestListSummary[]; total: number }> => {
  const where = listWhere({ churchId, kinds, canReadPrivate })
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
      kind: fromKind(r.kind),
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
  churchId,
  requestId,
  canReadPrivate,
  actorId,
  traceId,
}: {
  churchId: string
  requestId: string
  canReadPrivate: boolean
  actorId?: string | null
  traceId: string
}): Promise<RequestOutput | null> => {
  const row = await db.request.findFirst({
    where: { id: requestId, ...listWhere({ churchId, canReadPrivate }) },
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
    kind: fromKind(row.kind),
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
