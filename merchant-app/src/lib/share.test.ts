import { describe, expect, it } from 'vitest'
import { waPhoneDigits, whatsappUrl } from './share'

/**
 * The share message is the one string in this app that leaves it and lands in
 * someone else's WhatsApp, so it gets checked character by character. Every
 * message contains a '₹', a newline between rows, and Hinglish product names;
 * a link that mangles any of those sends the merchant's customers a broken
 * price list.
 */

/** A message shaped exactly like the ones the manage screen builds. */
const realisticMessage = [
  'Namaste! Meena Kirana Store ka digital price list dekhiye: https://merchant-app-black.vercel.app/#/dukaan/meena-kirana',
  'Aashirvaad Atta 5kg – ₹255.00',
  'Tata Salt 1kg – ₹28.00',
  'Availability may change.',
].join('\n')

describe('waPhoneDigits', () => {
  it('strips the punctuation that stored numbers carry', () => {
    expect(waPhoneDigits('+91 98765 43210')).toBe('919876543210')
    expect(waPhoneDigits('+91-98765-43210')).toBe('919876543210')
    expect(waPhoneDigits('(+91) 98765 43210')).toBe('919876543210')
  })

  it('treats a missing number as no number rather than throwing', () => {
    expect(waPhoneDigits(undefined)).toBe('')
    expect(waPhoneDigits(null)).toBe('')
    expect(waPhoneDigits('')).toBe('')
  })
})

describe('whatsappUrl', () => {
  it('builds the chooser form when no number is given', () => {
    expect(whatsappUrl('hello')).toBe('https://wa.me/?text=hello')
  })

  it('addresses a specific contact when a number is given', () => {
    expect(whatsappUrl('hello', '+91 98765 43210'))
      .toBe('https://wa.me/919876543210?text=hello')
  })

  it('is a wa.me URL, not something a browser will refuse to open', () => {
    const url = new URL(whatsappUrl(realisticMessage))
    expect(url.protocol).toBe('https:')
    expect(url.hostname).toBe('wa.me')
  })

  /* The round trip is the real assertion: whatever WhatsApp decodes out of the
     query must be byte-identical to what the merchant saw on screen. */
  it('round-trips a realistic message exactly', () => {
    const url = new URL(whatsappUrl(realisticMessage))
    expect(url.searchParams.get('text')).toBe(realisticMessage)
  })

  it('round-trips a Hindi and English mixed message exactly', () => {
    const hinglish = 'नमस्ते! आज का रेट लिस्ट देखिए\nचावल 1kg – ₹60\nदाल – ₹120'
    const url = new URL(whatsappUrl(hinglish, '919876543210'))
    expect(url.searchParams.get('text')).toBe(hinglish)
  })

  it('percent-encodes the characters that would otherwise corrupt the URL', () => {
    // '₹' is not URL-safe; a raw newline would terminate the value; a raw '&'
    // would start a second query parameter and silently truncate the message.
    expect(whatsappUrl('₹45')).toContain('%E2%82%B9')
    expect(whatsappUrl('a\nb')).toContain('%0A')
    expect(whatsappUrl('Atta & Dal')).toContain('%26')
  })

  it('keeps an ampersand inside the message instead of splitting the query', () => {
    const text = 'Atta & Dal – ₹255\nSugar & Tea – ₹90'
    const url = new URL(whatsappUrl(text))
    expect([...url.searchParams.keys()]).toEqual(['text'])
    expect(url.searchParams.get('text')).toBe(text)
  })

  it('survives a message that is nothing but awkward characters', () => {
    const text = '#? &=+%\n₹'
    expect(new URL(whatsappUrl(text)).searchParams.get('text')).toBe(text)
  })

  it('never claims to have sent anything', () => {
    // Guards the honesty boundary: this module builds a draft link only.
    expect(whatsappUrl('hi')).not.toContain('send')
  })
})
