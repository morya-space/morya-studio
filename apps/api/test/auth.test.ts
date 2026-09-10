import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'

describe('authentication routes', () => {
  it('registers a user and exposes the authenticated session', async () => {
    const app = createApp()
    const register = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'secret123' }),
    })
    const cookie = getSessionCookie(register)

    expect(register.status).toBe(200)
    await expect(register.json()).resolves.toMatchObject({
      user: { name: 'Ada', email: 'ada@example.com' },
    })

    const me = await app.request('/api/auth/me', { headers: { cookie } })
    expect(me.status).toBe(200)
    await expect(me.json()).resolves.toMatchObject({
      user: { name: 'Ada', email: 'ada@example.com' },
    })
  })

  it('rejects duplicate emails and invalid credentials', async () => {
    const app = createApp()
    const body = { name: 'Ada', email: 'ada@example.com', password: 'secret123' }
    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    const duplicate = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(duplicate.status).toBe(409)

    const invalidLogin = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: 'wrong123' }),
    })
    expect(invalidLogin.status).toBe(401)
  })

  it('invalidates the session on logout', async () => {
    const app = createApp()
    const register = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'secret123' }),
    })
    const cookie = getSessionCookie(register)

    const logout = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { cookie },
    })
    expect(logout.status).toBe(200)

    const me = await app.request('/api/auth/me', { headers: { cookie } })
    expect(me.status).toBe(401)
  })
})

function getSessionCookie(response: Response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
}