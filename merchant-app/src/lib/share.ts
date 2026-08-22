/**
 * WhatsApp sharing through wa.me deep links.
 *
 * wa.me is WhatsApp's own documented click-to-chat endpoint. It needs no
 * credentials and no tenant: it opens the installed app on a phone, or WhatsApp
 * Web in a new tab on a desktop, with the message already typed in. The sender
 * still presses send themselves.
 *
 * That last sentence is the whole honesty boundary of this module. Nothing here
 * is the WhatsApp Business Cloud API, and this app never delivers a message.
 */

/**
 * wa.me wants the number as digits only, in full international form. Stored
 * numbers carry '+', spaces and dashes, every one of which breaks the link.
 */
export function waPhoneDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

/**
 * Builds the deep link.
 *
 * Leaving the phone out is valid and is what sharing a price list needs:
 * WhatsApp then asks the sender which chat to drop the message into. Passing one
 * addresses that contact directly, which is what a supplier order needs.
 *
 * encodeURIComponent is the correct encoder for a query *value*. These messages
 * are full of the characters that would otherwise corrupt the URL: a newline
 * would end the text, an '&' would split it into a second query parameter, and
 * '₹' is not URL-safe at all.
 */
export function whatsappUrl(text: string, phone?: string | null): string {
  return `https://wa.me/${waPhoneDigits(phone)}?text=${encodeURIComponent(text)}`
}

export type WhatsappOutcome = 'opened' | 'blocked'

/**
 * Opens the deep link in a new tab, and reports whether that actually worked.
 *
 * `window.open` is deliberately called without the 'noopener' feature. With it,
 * browsers return null on success as well as on failure, so a blocked tab is
 * indistinguishable from a working one and the button looks broken while
 * silently doing nothing. Clearing `opener` immediately afterwards buys the same
 * isolation without throwing away the return value, so a caller that gets
 * 'blocked' can offer the message some other way instead of leaving the user
 * tapping a dead button.
 */
export function openWhatsapp(text: string, phone?: string | null): WhatsappOutcome {
  const opened = window.open(whatsappUrl(text, phone), '_blank')
  if (!opened) return 'blocked'
  try {
    opened.opener = null
  } catch {
    /* Cross-origin already, so the browser has isolated it for us. */
  }
  return 'opened'
}
