import crypto from 'node:crypto'
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda'
import { processAudioGenerateJob } from '@/controller/audio-generate-job'
import { processPrayerPublishJob } from '@/controller/prayer-publish-job'
import { processPaymentSyncJob } from '@/controller/payment-sync-job'
import { processVoiceRegisterJob } from '@/controller/voice-register-job'
import { processMailSendJob } from '@/controller/mail-send-job'
import { processNotificationSendJob } from '@/controller/notification-send-job'
import { logger } from '@/utils/logger'

/*
 * Consumer Lambda (SQS trigger).
 *
 * Entry point, like the poll loops in workers/: it maps a message to the job
 * controller that owns that kind. Every processXJob re-reads the outbox row and
 * requires state RUNNING, so SQS's at-least-once delivery is safe: a duplicate
 * returns 'skipped' and is NOT a failure.
 *
 * Only real infrastructure failures are reported as batch item failures, so SQS
 * retries (and eventually the DLQ) see genuine problems, not business outcomes —
 * business retry/backoff already lives in the outbox row (attempts/available_at).
 *
 * Never call process.exit here: it truncates logs and can drop the partial batch
 * response.
 */

export type JobOutcome = 'succeeded' | 'failed' | 'requeued' | 'skipped'

/** kind -> processor. Adding a worker kind adds one line here. */
export const HANDLERS: Record<string, (jobId: string, requestId: string) => Promise<JobOutcome>> = {
  'audio.generate': processAudioGenerateJob,
  'prayer.publish': processPrayerPublishJob,
  'payment.sync': processPaymentSyncJob,
  'voice.register': processVoiceRegisterJob,
  'mail.send': processMailSendJob,
  'notification.send': processNotificationSendJob,
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: { itemIdentifier: string }[] = []

  for (const record of event.Records) {
    let kind = 'unknown'
    let jobId = ''

    try {
      const body = JSON.parse(record.body) as { kind?: string; jobId?: string }
      kind = body.kind ?? 'unknown'
      jobId = body.jobId ?? ''

      const process = HANDLERS[kind]
      if (!process || !jobId) {
        logger.error('job_message_invalid', { job_kind: kind, message_id: record.messageId })
        batchItemFailures.push({ itemIdentifier: record.messageId })
        continue
      }

      const outcome = await process(jobId, crypto.randomUUID())
      logger.info('job_processed', { job_kind: kind, job_id: jobId, outcome })
    } catch {
      logger.error('job_processing_failed', {
        job_kind: kind,
        job_id: jobId,
        error_code: 'CONSUMER_ERROR',
      })
      batchItemFailures.push({ itemIdentifier: record.messageId })
    }
  }

  return { batchItemFailures }
}
