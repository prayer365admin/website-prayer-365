import { imageFormats, videoFormats } from '@/data/media-format-list'

export function extensionChecker(media_url: string) {
  const isImage = imageFormats.some((format) => media_url.toLowerCase().endsWith(format))
  const isVideo = videoFormats.some((format) => media_url.toLowerCase().endsWith(format))

  if (!isImage && !isVideo) return 'OTHERS'
  if (isImage) return 'IMAGE'
  if (isVideo) return 'VIDEO'
}
