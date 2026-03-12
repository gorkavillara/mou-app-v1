import CryptoJS from 'crypto-js'

export function generatePatientKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString()
}

export function encrypt(data: string, key: string): string {
  if (!key) {
    throw new Error('Encryption key is required')
  }
  return CryptoJS.AES.encrypt(data, key).toString()
}

export function decrypt(ciphertext: string, key: string): string {
  if (!key) {
    throw new Error('Decryption key is required')
  }
  const bytes = CryptoJS.AES.decrypt(ciphertext, key)
  const decrypted = bytes.toString(CryptoJS.enc.Utf8)
  if (!decrypted) {
    throw new Error('Decryption failed - invalid key or corrupted data')
  }
  return decrypted
}

export function hashData(data: string): string {
  return CryptoJS.SHA256(data).toString()
}
