import nodemailer, { Transporter } from 'nodemailer'
import type { SendMailOptions } from 'nodemailer'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import path from 'path'
import fs from 'fs'
import { GeneralError } from '@/utils/general-error'
import dayjs from 'dayjs'
import { sendMailRequest } from '@/models/send-mail'

const mailEnv = (() => {
  if (!process.env.MAIL_CREDENTIALS) return process.env
  try {
    // The secret carries credentials only. Provider selection is deployment
    // configuration (Lambda env / Vercel env), so a stale MAIL_PROVIDER in an old
    // secret version must not silently win over it.
    const parsed = JSON.parse(process.env.MAIL_CREDENTIALS) as Record<string, string>
    delete parsed.MAIL_PROVIDER
    return { ...process.env, ...parsed }
  } catch {
    return process.env
  }
})()

const mailProvider = process.env.MAIL_PROVIDER || 'mailtrap'

/**
 * Builds the transport for one provider. `MAIL_PROVIDER` selects it, so moving
 * between SES, Mailgun and Mailtrap is an environment change, not a code change.
 */
export function createMailTransport(provider: string, env = process.env): Transporter {
  // With Amazon SES (API, not the SMTP interface: it reuses the IAM keys the app
  // already holds for S3). nodemailer 10 expects SESv2 — `{ sesClient,
  // SendEmailCommand }`; the older `{ ses, aws }` shape is rejected at send time.
  // The identity is per-region: SES_REGION must match where the domain was verified.
  if (provider === 'ses') {
    return nodemailer.createTransport({
      SES: {
        sesClient: new SESv2Client({ region: env.SES_REGION ?? env.AWS_REGION }),
        SendEmailCommand,
      },
    })
  }

  // With MailGun
  if (provider === 'mailgun') {
    return nodemailer.createTransport({
      host: 'smtp.mailgun.org',
      port: 587,
      secure: false,
      auth: {
        user: env.MAILGUN_USER,
        pass: env.MAILGUN_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })
  }

  // With MailTrap
  if (provider === 'mailtrap') {
    return nodemailer.createTransport({
      host: 'sandbox.smtp.mailtrap.io',
      port: 2525,
      auth: {
        user: env.MAILTRAP_USER,
        pass: env.MAILTRAP_PASSWORD,
      },
    })
  }

  // An unknown value used to leave `transport` undefined, so the first send died
  // with a TypeError (`Cannot read properties of undefined`) far from the cause.
  throw new GeneralError({
    error: 'mail provider not supported',
    error_code: 'MAIL_PROVIDER_UNSUPPORTED',
    details: `MAIL_PROVIDER="${provider}" has no transport. Use mailtrap, mailgun or ses.`,
    code: 500,
  })
}

let transport: Transporter | undefined

/** Built on the first send, so a bad MAIL_PROVIDER cannot break the module import. */
function getTransport(): Transporter {
  if (!transport) transport = createMailTransport(mailProvider, mailEnv)
  return transport
}

export default async function sendMail(request: sendMailRequest) {
  const { from, to, subject, template_name, payload, attachment, baseUrl, host } = request

  const filePath = path.resolve('./public/templates/mail', `${template_name}.html`)

  const checkFile = fs.existsSync(filePath)
  if (!checkFile) {
    throw new GeneralError({
      error: 'template file not found',
      error_code: 'NOT_FOUND',
      details: 'Template file not found!',
      code: 404,
    })
  }

  const hbs = await import('handlebars')
  const dataParse = {
    ...payload,
    baseUrl,
    host: host || process.env.BASE_URL || 'localhost',
    currentDate: dayjs().format('DD MMMM, YYYY'),
  }

  const mailFile = fs.readFileSync(filePath, 'utf8')
  const mailTemplate = hbs.compile(mailFile)
  const mailContent = mailTemplate(dataParse)

  const mailOptions: SendMailOptions = {
    from: from,
    to: to,
    subject: subject,
    html: template_name && mailContent,
    attachments: attachment && attachment,
  }

  try {
    await getTransport().sendMail(mailOptions)
  } catch (error) {
    throw error
  }
}
