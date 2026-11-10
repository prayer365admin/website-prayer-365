import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The mailer picks its transport from MAIL_PROVIDER. These tests lock the provider
 * contract: SES uses the SESv2 shape nodemailer 10 requires, the SMTP branches stay
 * intact, and an unknown value fails loudly instead of crashing at the first send.
 */

const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail: vi.fn() })))
const sesClient = vi.hoisted(() => vi.fn())
const sendEmailCommand = vi.hoisted(() => class SendEmailCommand {})

vi.mock('nodemailer', () => ({
  default: { createTransport },
  createTransport,
}))

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: sesClient,
  SendEmailCommand: sendEmailCommand,
}))

import { createMailTransport } from '@/controller/mail'
import { GeneralError } from '@/utils/general-error'

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv

describe('createMailTransport', () => {
  beforeEach(() => {
    createTransport.mockClear()
    sesClient.mockClear()
  })

  it('builds the SESv2 transport for MAIL_PROVIDER=ses', () => {
    createMailTransport('ses', env({ SES_REGION: 'eu-north-1' }))

    expect(sesClient).toHaveBeenCalledWith({ region: 'eu-north-1' })
    expect(createTransport).toHaveBeenCalledWith({
      SES: { sesClient: expect.anything(), SendEmailCommand: sendEmailCommand },
    })
  })

  it('falls back to AWS_REGION when SES_REGION is not set', () => {
    createMailTransport('ses', env({ AWS_REGION: 'ap-southeast-1' }))

    expect(sesClient).toHaveBeenCalledWith({ region: 'ap-southeast-1' })
  })

  it('keeps the mailgun SMTP transport', () => {
    createMailTransport('mailgun', env({ MAILGUN_USER: 'u', MAILGUN_PASSWORD: 'p' }))

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.mailgun.org',
        port: 587,
        auth: { user: 'u', pass: 'p' },
      }),
    )
  })
  it('honors credentials passed in the env argument', () => {
    createMailTransport(
      'mailgun',
      env({ MAILGUN_USER: 'custom-user', MAILGUN_PASSWORD: 'custom-password' }),
    )

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: 'custom-user', pass: 'custom-password' },
      }),
    )
  })

  it('keeps the mailtrap SMTP transport', () => {
    createMailTransport('mailtrap', env({ MAILTRAP_USER: 'u', MAILTRAP_PASSWORD: 'p' }))

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'sandbox.smtp.mailtrap.io',
        port: 2525,
        auth: { user: 'u', pass: 'p' },
      }),
    )
  })

  it('builds the Brevo SMTP relay transport, honoring server and port overrides', () => {
    createMailTransport(
      'brevo',
      env({
        BREVO_SMTP_SERVER: 'smtp-relay.brevo.com',
        BREVO_SMTP_PORT: '587',
        BREVO_SMTP_USER: 'u4',
        BREVO_SMTP_KEY: 'k4',
      }),
    )

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: 'u4', pass: 'k4' },
    })
  })

  it('falls back to the default Brevo relay when server and port are unset', () => {
    createMailTransport('brevo', env({ BREVO_SMTP_USER: 'u5', BREVO_SMTP_KEY: 'k5' }))

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp-relay.brevo.com', port: 587 }),
    )
  })

  it('fails loudly on an unknown provider', () => {
    let thrown: unknown
    try {
      createMailTransport('sendgrid')
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(GeneralError)
    expect((thrown as GeneralError).error_code).toBe('MAIL_PROVIDER_UNSUPPORTED')
    expect(createTransport).not.toHaveBeenCalled()
  })
})

describe('provider precedence', () => {
  it('ignores MAIL_PROVIDER inside MAIL_CREDENTIALS, so a stale secret cannot win', async () => {
    vi.resetModules()
    vi.stubEnv('MAIL_PROVIDER', 'ses')
    vi.stubEnv('SES_REGION', 'eu-north-1')
    // An older secret version that still carries the old provider key.
    vi.stubEnv(
      'MAIL_CREDENTIALS',
      JSON.stringify({ MAIL_PROVIDER: 'mailtrap', MAILTRAP_USER: 'stale-user' }),
    )
    createTransport.mockClear()
    sesClient.mockClear()

    const { default: sendMail } = await import('@/controller/mail')
    await sendMail({
      from: 'noreply@example.com',
      to: 'user@example.com',
      subject: 'Provider precedence',
      template_name: 'verify-email',
      payload: { link: 'https://example.com' },
    })

    expect(sesClient).toHaveBeenCalledWith({ region: 'eu-north-1' })
    expect(createTransport).toHaveBeenCalledWith({
      SES: { sesClient: expect.anything(), SendEmailCommand: sendEmailCommand },
    })
    vi.unstubAllEnvs()
  })
})
