/**
 * Copy text to the clipboard. Returns false when the browser refuses.
 * navigator.clipboard is missing or refused in some iPhone browsers (in-app browsers such as WhatsApp's, older iOS),
 * so fall back to selecting a temporary text field and using the legacy copy command, which iOS Safari accepts
 * as long as it runs inside the tap.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy method
  }
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.top = '0'
  field.style.left = '0'
  field.style.opacity = '0'
  field.style.fontSize = '16px' // iOS zooms and may refuse to select smaller text
  document.body.appendChild(field)
  try {
    field.focus()
    field.select()
    field.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(field)
  }
}
