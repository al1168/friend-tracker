import { describe, expect, it } from 'vitest'
import { base64ToBytes, base64urlToBytes, bytesToBase64, bytesToBase64url } from './base64'

describe('base64', () => {
  it('encodes and decodes standard base64', () => {
    const bytes = new TextEncoder().encode('hello')
    expect(bytesToBase64(bytes)).toBe('aGVsbG8=')
    expect(base64ToBytes('aGVsbG8=')).toEqual(bytes)
  })

  it('encodes URL-safe base64 without padding', () => {
    const bytes = new Uint8Array([251, 255, 191])
    expect(bytesToBase64(bytes)).toBe('+/+/')
    expect(bytesToBase64url(bytes)).toBe('-_-_')
    expect(bytesToBase64url(new Uint8Array([1]))).toBe('AQ')
  })

  it('round-trips any bytes', () => {
    const bytes = new Uint8Array(256).map((_, i) => i)
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
    expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes)
    expect(base64urlToBytes(bytesToBase64url(bytes.slice(0, 31)))).toEqual(bytes.slice(0, 31))
  })
})
