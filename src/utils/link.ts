/** Staff may paste a link without a scheme; assume https. Empty input means no link. */
export const normalizeLink = (value?: string) => {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** https only (SPEC), with a dotted host so bare words like "https://x" are rejected. */
export const isHttpsLink = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.includes('.')
  } catch {
    return false
  }
}
