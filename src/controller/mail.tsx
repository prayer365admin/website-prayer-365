import nodemailer, { Transporter } from 'nodemailer'
import type { SendMailOptions } from 'nodemailer'
import path from 'path'
import fs from 'fs'
import { GeneralError } from '@/utils/general-error'
import dayjs from 'dayjs'
import { sendMailRequest } from '@/models/send-mail'

let transport: Transporter
const mailProvider = process.env.MAIL_PROVIDER || 'mailtrap'

// With MailTrap
if (mailProvider === 'mailtrap') {
  transport = nodemailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASSWORD,
    },
  })
}

// With MailGun
if (mailProvider === 'mailgun') {
  transport = nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAILGUN_USER,
      pass: process.env.MAILGUN_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  })
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
    await transport.sendMail(mailOptions)
  } catch (error) {
    throw error
  }
}
