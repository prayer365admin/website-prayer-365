import { AuditLog, Prisma } from '@prisma/client'
import { logger } from '@/utils/logger'

/*
 * Audit writer (SPEC §2.2, §11.1). Inserted inside the caller's transaction so
 * the business change and its audit record commit atomically.
 *
 * It NEVER accepts sensitive payloads (request message, contacts, tokens,
 * provider secrets). It logs a structured, redacted summary line via winston.
 */

export interface AuditInput {
  actorId?: string | null
  churchId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  outcome: string
  requestId: string
}

/** Build the DB insert payload for an audit log row. */
export const auditPayload = (input: AuditInput): Prisma.AuditLogUncheckedCreateInput => ({
  actor_id: input.actorId ?? null,
  church_id: input.churchId ?? null,
  action: input.action,
  resource_type: input.resourceType,
  resource_id: input.resourceId ?? null,
  outcome: input.outcome,
  request_id: input.requestId,
})

/** Audit shape used inside a transaction: pass `tx.auditLog.create`. */
export const writeAudit = async (
  create: (data: Prisma.AuditLogUncheckedCreateInput) => Promise<AuditLog>,
  input: AuditInput,
) => {
  const row = await create(auditPayload(input))
  logger.info('audit', {
    request_id: input.requestId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    outcome: input.outcome,
  })
  return row
}
