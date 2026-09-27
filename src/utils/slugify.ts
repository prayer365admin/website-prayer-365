import slugify from 'slugify'
import { generateRandomString } from './generate-random-string'

export default function customSlugify({ text, isExists }: { text: string; isExists: boolean }) {
  let textParse = text
  if (isExists) {
    textParse = `${text}-${generateRandomString(6)}`
  }

  return slugify(textParse, { lower: true, strict: true, replacement: '-' })
}
