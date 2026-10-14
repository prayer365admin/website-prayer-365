// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Mock the AWS SDK so the suite never touches a real SQS endpoint. The mock
 * records every command instance so we can assert the message body.
 */
const sent: { QueueUrl?: string; MessageBody?: string }[] = []
vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: class {
    send(command: { input: { QueueUrl?: string; MessageBody?: string } }) {
      sent.push(command.input)
      return Promise.resolve({})
    }
  },
  SendMessageCommand: class {
    constructor(public input: { QueueUrl?: string; MessageBody?: string }) {}
  },
}))

import { SQS_SEND_JOB } from './sqs'

beforeEach(() => {
  sent.length = 0
  delete process.env.AWS_REGION
})

describe('SQS_SEND_JOB', () => {
  it('sends the job reference as JSON to the queue', async () => {
    process.env.AWS_REGION = 'ap-southeast-1'
    await SQS_SEND_JOB({ queueUrl: 'https://sqs/q', kind: 'audio.generate', jobId: 'job-1' })

    expect(sent).toHaveLength(1)
    expect(sent[0].QueueUrl).toBe('https://sqs/q')
    expect(JSON.parse(sent[0].MessageBody ?? '{}')).toEqual({
      kind: 'audio.generate',
      jobId: 'job-1',
    })
  })

  it('rejects with SQS_NOT_CONFIGURED when the queue URL is missing', async () => {
    await expect(
      SQS_SEND_JOB({ queueUrl: '', kind: 'audio.generate', jobId: 'job-1' }),
    ).rejects.toMatchObject({ code: 500, error_code: 'SQS_NOT_CONFIGURED' })
    expect(sent).toHaveLength(0)
  })
})
