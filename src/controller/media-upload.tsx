import dayjs from 'dayjs'
import { S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { v4 as uuidv4 } from 'uuid'
import { mediaUploadModels } from '@/models/media-upload'
import { GeneralError } from '@/utils/general-error'

export async function mediaUpload({ filename, filetype }: mediaUploadModels) {
  const date = dayjs().format('YYYY/MM/DD')
  const client = new S3Client({ region: process.env.AWS_REGION })

  const prefix = process.env.AWS_PREFIX ? `${process.env.AWS_PREFIX}/` : ''
  const key = `${prefix}${date}/${uuidv4()}-${filename}`

  try {
    // Create the presigned post
    const { url, fields } = await createPresignedPost(client, {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
      Conditions: [['starts-with', '$Content-Type', filetype]],
      Fields: {
        'Content-Type': filetype,
      },
    })

    return {
      url: url,
      fields: fields,
      key: key,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new GeneralError({
        code: 500,
        details: 'Failed to upload file',
        error_code: 'UPLOAD_FAILED',
        error: error.message,
      })
    }
  }
}
