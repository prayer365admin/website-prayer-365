import { useMutation } from '@tanstack/react-query'
import { App } from 'antd'
import axios from 'axios'
import { useCallback } from 'react'

/*
 * Single GLOBAL upload API (SPEC §10.4). Entity context (purpose + an OPTIONAL
 * churchId) is passed to the hook and carried in the request body — one
 * /api/v1/uploads endpoint for every entity, no per-entity upload routes.
 * Without a churchId the asset is a General asset owned by the caller.
 *
 * Flow:
 *  1. POST /api/v1/uploads { churchId?, purpose, mimeType, byteSize }
 *     → { assetId, objectKey, uploadUrl, fields, expiresIn }
 *  2. POST the file directly to `uploadUrl` with `fields` (presigned S3 post).
 *  3. POST /api/v1/uploads/:assetId/complete { churchId?, checksum } → READY.
 *
 * Browser admin is same-origin → NextAuth cookie is sent automatically, so no
 * manual Authorization header is needed here.
 */

const sha256hex = async (data: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const useMediaUpload = ({
  churchId,
  purpose,
}: {
  churchId?: string
  purpose: 'IMAGE' | 'VOICE_SAMPLE' | 'CONSENT_EVIDENCE' | 'USER_AVATAR'
}) => {
  const { notification } = App.useApp()
  const { mutateAsync: onUpload, isPending: loading } = useMutation({
    mutationFn: useCallback(
      async (file: File | null) => {
        if (!file) {
          throw new Error('Please select a file to upload.')
        }

        const initiate = await axios.post('/api/v1/uploads', {
          ...(churchId ? { churchId } : {}),
          purpose,
          mimeType: file.type || 'application/octet-stream',
          byteSize: file.size,
        })

        const { assetId, uploadUrl, fields } = initiate.data.result

        const formData = new FormData()
        Object.entries(fields).forEach(([key, value]) => {
          formData.append(key, String(value))
        })
        formData.append('file', file)

        const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: formData })
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          notification.error({ message: 'Upload Failed', description: errorText })
          throw new Error('Failed to upload file to storage.')
        }

        // Complete: verify object size/content-type server-side + checksum → READY.
        const checksum = await sha256hex(await file.arrayBuffer())
        await axios.post(`/api/v1/uploads/${assetId}/complete`, {
          ...(churchId ? { churchId } : {}),
          checksum,
        })

        return {
          assetId,
          url: churchId
            ? `/api/v1/uploads/${assetId}/access?churchId=${encodeURIComponent(churchId)}`
            : // User-scoped assets have no scoped access route; the caller only needs a preview.
              URL.createObjectURL(file),
        }
      },
      [churchId, purpose, notification],
    ),
    onSuccess: () => {
      notification.success({
        message: 'Upload Successful',
        description: 'The file has been uploaded.',
      })
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data
        let description = data?.details || data?.message || 'Failed to upload file.'

        if (data?.error_code === 'MEDIA_CONSTRAINT') {
          const formatError = data?.fields?.mimeType ? 'Unsupported file format.' : ''
          const sizeError = data?.fields?.byteSize ? 'File size exceeds the maximum limit.' : ''
          const combined = [formatError, sizeError].filter(Boolean).join(' ')

          description =
            combined || 'This file format or size is not supported for this upload type.'
        }

        notification.error({
          message: 'Upload Failed',
          description,
        })
      } else {
        notification.error({ message: 'Upload Failed', description: 'Failed to upload file.' })
      }
    },
  })

  return { onUpload, loading }
}
