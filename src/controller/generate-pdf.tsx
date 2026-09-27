import puppeteer from 'puppeteer-core'
import localPuppeteer from 'puppeteer'
import chromium from '@sparticuz/chromium'
import path from 'path'
import fs from 'fs'
import dayjs from 'dayjs'
import { generatePdfRequest } from '@/models/generate-pdf'
import { GeneralError } from '@/utils/general-error'

export default async function generatePdf({
  template_name,
  mode,
  payload,
  baseUrl,
  host,
}: { baseUrl: string; host?: string } & generatePdfRequest) {
  try {
    const filePath = path.resolve('./public/templates/pdf', `${template_name}.html`)

    const CHROMIUM_PACK_URL =
      'https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar'

    if (mode !== 'DOWNLOAD' && mode !== 'VIEW') {
      throw new GeneralError({
        error: 'Invalid mode',
        error_code: 'BAD_REQUEST',
        details: 'Invalid mode!',
        code: 400,
      })
    }

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
      currentDate: dayjs().format('DD MMMM, YYYY'),
      host: host || process.env.BASE_URL || 'localhost',
    }
    const executablePath =
      process.env.IS_VERCEL === 'true'
        ? await chromium.executablePath(CHROMIUM_PACK_URL)
        : undefined

    const browser =
      process.env.IS_VERCEL === 'true'
        ? await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: executablePath,
            headless: true,
          })
        : await localPuppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: undefined,
            headless: true,
          })

    const page = await browser.newPage()

    const headerHTML = fs.readFileSync(
      path.resolve('./public/templates/pdf', 'header.html'),
      'utf8',
    )
    const headerTemplate = hbs.compile(headerHTML)
    const headerContent = headerTemplate(dataParse)

    const footerHTML = fs.readFileSync(
      path.resolve('./public/templates/pdf', 'footer.html'),
      'utf8',
    )
    const footerTemplate = hbs.compile(footerHTML)
    const footerContent = footerTemplate(dataParse)

    const html = fs.readFileSync(filePath, 'utf8')
    const template = hbs.compile(html)
    const content = template(dataParse)

    await page.setContent(content, { waitUntil: 'load' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '150px',
        bottom: '150px',
        left: '75px',
        right: '75px',
      },
      displayHeaderFooter: true,
      headerTemplate: headerContent,
      footerTemplate: footerContent,
      printBackground: true,
    })
    await browser.close()

    return pdfBuffer
  } catch (error) {
    throw error
  }
}
