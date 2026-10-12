import { AvatarMimeType, MobileAvatarUploadOutput } from '@/models/mobile-avatar'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useMe } from './me'

/*
 * Website avatar upload (WB-16): sign → upload the bytes straight to S3 →
 * save the public URL on the profile. Same three steps as the mobile app
 * (public bucket, D13), so the URL is uploadUrl + objectKey.
 */
export const useAvatarUpload = () => {
  const { onPatch } = useMe()

  const { mutateAsync: onUpload, isPending: uploading } = useMutation({
    mutationFn: async (file: File) => {
      const sign = (
        await axios.post('/api/v1/site/me/avatar', {
          mimeType: file.type as AvatarMimeType,
          byteSize: file.size,
        })
      ).data.result as MobileAvatarUploadOutput

      const form = new FormData()
      Object.entries(sign.fields).forEach(([key, value]) => form.append(key, value))
      form.append('file', file) // S3 requires the file to be the last field
      await axios.post(sign.uploadUrl, form)

      const profilePicture = new URL(sign.objectKey, sign.uploadUrl).toString()
      return onPatch({ profilePicture })
    },
  })

  return { onUpload, uploading }
}
