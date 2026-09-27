import { useMutation } from '@tanstack/react-query'
import { notification } from 'antd'
import axios from 'axios'
import { useCallback } from 'react'

const url = '/api/v1/uploads'

export const useMediaUpload = () => {
  const { mutateAsync: onUpload, isPending: loading } = useMutation({
    mutationFn: useCallback(async (file: File | null) => {
      if (!file) {
        throw new Error('Please select a file to upload.')
      }

      const filename = file.name
      const filetype = file.type

      const response = await axios.post(`${url}`, { filename, filetype })

      const formData = new FormData()
      Object.entries(response.data.fields).forEach(([key, value]) => {
        formData.append(key, value as string)
      })
      formData.append('file', file)

      const uploadResponse = await fetch(response.data.url, {
        method: 'POST',
        body: formData,
      })
      const errorText = await uploadResponse.text()

      if (!uploadResponse.ok) {
        notification.error({
          message: 'Upload Failed',
          description: errorText,
        })
      }

      if (response.status !== 200) {
        throw new Error('Failed to upload file.')
      }

      return `${response.data.url}${response.data.key}`
    }, []),
    onSuccess: (_data) => {
      notification.success({
        message: 'Upload Successful',
        description: 'The file has been successfully uploaded.',
      })
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        notification.error({
          message: 'Upload Failed',
          description: error.response?.data?.message || 'Failed to upload file.',
        })
      } else {
        notification.error({
          message: 'Upload Failed',
          description: 'Failed to upload file.',
        })
      }
    },
  })

  return {
    onUpload,
    loading: loading,
  }
}
