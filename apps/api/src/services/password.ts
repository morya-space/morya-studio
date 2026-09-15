import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

export async function hashPassword(password: string) {
  const salt = crypto.randomUUID().replaceAll('-', '')
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer
  return `scrypt$${salt}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith('scrypt$')) {
    const [, salt, digest] = storedHash.split('$')
    if (!salt || !digest)
      return false
    const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer
    const expected = Buffer.from(digest, 'hex')
    return expected.length === derived.length && timingSafeEqual(expected, derived)
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Buffer.from(digest).toString('hex') === storedHash
}
