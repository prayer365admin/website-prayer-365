import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import type { MailSendRequest } from '@/models/send-mail'

/**
 * Queue one mail into the SQS pipeline through the outbox.
 *
 * `skipDuplicates` makes the enqueue idempotent on `dedupe_key`: fan-out senders
 * (notification channels) re-run their whole audience on every job attempt, and
 * the unique key — not the caller — decides what has already been queued.
 */
export const ENQUEUE_MAIL_SEND = async (
  {
    message,
    dedupeKeySuffix,
    skipDuplicates = false,
  }: { message: MailSendRequest; dedupeKeySuffix: string; skipDuplicates?: boolean },
  tx: Prisma.TransactionClient = db,
): Promise<void> => {
  const data = {
    kind: 'mail.send',
    dedupe_key: `mail.send:${dedupeKeySuffix}`,
    // SAFETY: MailSendRequest is JSON-serializable into Prisma.InputJsonValue
    payload: message as unknown as Prisma.InputJsonValue,
    available_at: new Date(),
  }

  if (skipDuplicates) {
    await tx.outboxJob.createMany({ data: [data], skipDuplicates: true })
    return
  }
  await tx.outboxJob.create({ data })
}
