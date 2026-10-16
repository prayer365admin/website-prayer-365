import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { GeneralError } from '@/utils/general-error'

/*
 * SQS adapter for the job queue (SPEC §10.3). THIN provider only: it sends and
 * receives references, it contains no business rules and no scoping — the
 * consumer Lambda re-reads the outbox row and re-proves every business fact.
 *
 * Lazy client, like the S3 provider: importing this module never throws when env
 * credentials are absent; a call fails once it actually needs the queue.
 */

const notConfigured = () =>
  new GeneralError({
    code: 500,
    error: 'INTERNAL_ERROR',
    error_code: 'SQS_NOT_CONFIGURED',
    details: 'Job queue is not configured.',
  })

const client = () => new SQSClient({ region: process.env.AWS_REGION })

export interface JobMessage {
  kind: string
  jobId: string
}

/** Send one job reference. The outbox row is already claimed (RUNNING + lease). */
export const SQS_SEND_JOB = async ({
  queueUrl,
  kind,
  jobId,
}: { queueUrl: string } & JobMessage): Promise<void> => {
  if (!queueUrl) throw notConfigured()
  await client().send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ kind, jobId }),
    }),
  )
}
