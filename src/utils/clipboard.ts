/**
 * Copy text to the clipboard.
 *
 * `navigator.clipboard` only exists in a secure context (https / localhost) and is
 * still denied on some browsers and embedded views, so a plain `writeText` call
 * silently does nothing there. Fall back to the legacy selection copy, and report
 * the outcome so the UI can say "Copied" or "Copy failed" instead of no-oping.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission denied / not focused: fall through to the legacy path.
    }
  }

  if (typeof document === 'undefined') return false

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}
