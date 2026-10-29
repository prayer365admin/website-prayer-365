import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import type { MailSendRequest } from '@/models/send-mail'

export const ENQUEUE_MAIL_SEND = async (
  { message, dedupeKeySuffix }: { message: MailSendRequest; dedupeKeySuffix: string },
  tx: Prisma.TransactionClient = db,
): Promise<void> => {
  await tx.outboxJob.create({
    data: {
      kind: 'mail.send',
      dedupe_key: `mail.send:${dedupeKeySuffix}`,
      // SAFETY: MailSendRequest is JSON-serializable into Prisma.InputJsonValue
      payload: message as unknown as Prisma.InputJsonValue,
      available_at: new Date(),
    },
  })
}
