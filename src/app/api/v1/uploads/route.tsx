import { mediaUpload } from '@/controller/media-upload'
import { mediaUploadModels } from '@/models/media-upload'
import { GeneralError } from '@/utils/general-error'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { filename, filetype }: mediaUploadModels = await request.json()

  try {
    const response = await mediaUpload({
      filename,
      filetype,
    })

    if (!response) {
      throw new GeneralError({
        code: 500,
        details: 'Failed to upload file',
        error_code: 'UPLOAD_FAILED',
        error: 'Upload failed',
      })
    }

    return NextResponse.json({
      url: response.url,
      fields: response.fields,
      key: response.key,
    })
  } catch (error) {
    if (error instanceof GeneralError) {
      return NextResponse.json(error, { status: error.code })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  }
}
