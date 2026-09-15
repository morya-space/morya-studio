import { ALL_PERMISSION_CODES, SEED_SUPER_ADMIN, SYSTEM_ROLE_IDS } from '@morya-studio/shared'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'

describe('identity and rbac routes', () => {
  it('seeds an admin account and assigns viewer to self-registered users', async () => {
    const app = createApp()
    const register = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'secret123' }),
    })

    expect(register.status).toBe(200)
    await expect(register.json()).resolves.toMatchObject({
      user: {
        name: 'Ada',
        email: 'ada@example.com',
        status: 'active',
        roles: [expect.objectContaining({ id: SYSTEM_ROLE_IDS.viewer, name: '访客' })],
        permissions: expect.arrayContaining(['profile.read', 'security.read']),
      },
    })

    const adminLogin = await login(app, SEED_SUPER_ADMIN.email, SEED_SUPER_ADMIN.password)
    expect(adminLogin.status).toBe(200)
    const adminBody = await adminLogin.json()
    expect(adminBody.user.roles).toEqual([
      expect.objectContaining({ id: SYSTEM_ROLE_IDS.admin, name: '超级管理员' }),
    ])
    expect(adminBody.user.permissions).toEqual([...ALL_PERMISSION_CODES].sort())

    const roles = await json(app, '/api/roles', { headers: { cookie: getSessionCookie(adminLogin) } })
    const adminRole = roles.items.find((role: { id: string; permissions: string[] }) => role.id === SYSTEM_ROLE_IDS.admin)
    expect(adminRole).toMatchObject({
      name: '超级管理员',
      isSystem: true,
    })
    expect([...(adminRole?.permissions ?? [])].sort()).toEqual([...ALL_PERMISSION_CODES].sort())
  })

  it('rejects unauthenticated identity requests and forbids viewers from managing users', async () => {
    const app = createApp()
    const anonymous = await app.request('/api/users')
    expect(anonymous.status).toBe(401)

    const register = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'secret123' }),
    })
    const cookie = getSessionCookie(register)

    const forbidden = await app.request('/api/users', { headers: { cookie } })
    expect(forbidden.status).toBe(403)
  })

  it('lets an admin create, update and delete users except the last admin or themselves', async () => {
    const app = createApp()
    const adminCookie = await adminCookieFor(app)
    const roles = await json(app, '/api/roles', { headers: { cookie: adminCookie } })
    const editorRoleId = roles.items.find((role: { id: string }) => role.id === SYSTEM_ROLE_IDS.editor).id

    const created = await app.request('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        name: 'Ed',
        email: 'ed@example.com',
        password: 'secret123',
        roleIds: [editorRoleId],
      }),
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const updated = await app.request(`/api/users/${createdBody.user.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ status: 'disabled' }),
    })
    expect(updated.status).toBe(200)
    await expect(updated.json()).resolves.toMatchObject({ user: { status: 'disabled' } })

    const disabledLogin = await login(app, 'ed@example.com', 'secret123')
    expect(disabledLogin.status).toBe(403)

    const deleted = await app.request(`/api/users/${createdBody.user.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(deleted.status).toBe(200)

    const me = await json(app, '/api/auth/me', { headers: { cookie: adminCookie } })
    const deleteSelf = await app.request(`/api/users/${me.user.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(deleteSelf.status).toBe(403)

    const disableLastAdmin = await app.request(`/api/users/${me.user.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ status: 'disabled' }),
    })
    expect(disableLastAdmin.status).toBe(403)
  })

  it('supports custom roles and protects system roles', async () => {
    const app = createApp()
    const adminCookie = await adminCookieFor(app)

    const created = await app.request('/api/roles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        name: '审计员',
        description: '只读权限目录',
        permissions: ['permissions.read', 'profile.read'],
      }),
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const updated = await app.request(`/api/roles/${createdBody.role.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ permissions: ['permissions.read'] }),
    })
    expect(updated.status).toBe(200)

    const systemUpdate = await app.request(`/api/roles/${SYSTEM_ROLE_IDS.admin}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ permissions: ['profile.read'] }),
    })
    expect(systemUpdate.status).toBe(403)

    const systemDelete = await app.request(`/api/roles/${SYSTEM_ROLE_IDS.viewer}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(systemDelete.status).toBe(403)

    const deleted = await app.request(`/api/roles/${createdBody.role.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(deleted.status).toBe(200)
  })

  it('updates profile, changes password and revokes other sessions', async () => {
    const app = createApp()
    const register = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Chrome/120' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'secret123' }),
    })
    const firstCookie = getSessionCookie(register)

    const profile = await app.request('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: firstCookie },
      body: JSON.stringify({ name: 'Ada Lovelace' }),
    })
    expect(profile.status).toBe(200)
    await expect(profile.json()).resolves.toMatchObject({ user: { name: 'Ada Lovelace' } })

    const secondLogin = await login(app, 'ada@example.com', 'secret123')
    const secondCookie = getSessionCookie(secondLogin)
    expect(secondCookie).not.toBe(firstCookie)

    const password = await app.request('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: secondCookie },
      body: JSON.stringify({ currentPassword: 'secret123', newPassword: 'secret456' }),
    })
    expect(password.status).toBe(200)

    const stale = await app.request('/api/auth/me', { headers: { cookie: firstCookie } })
    expect(stale.status).toBe(401)

    const thirdLogin = await login(app, 'ada@example.com', 'secret456')
    const thirdCookie = getSessionCookie(thirdLogin)
    const extraLogin = await login(app, 'ada@example.com', 'secret456')
    const extraCookie = getSessionCookie(extraLogin)

    const sessions = await json(app, '/api/auth/sessions', { headers: { cookie: thirdCookie } })
    expect(sessions.items.length).toBeGreaterThanOrEqual(2)

    const revokeOthers = await app.request('/api/auth/sessions/others', {
      method: 'DELETE',
      headers: { cookie: thirdCookie },
    })
    expect(revokeOthers.status).toBe(200)

    const extraMe = await app.request('/api/auth/me', { headers: { cookie: extraCookie } })
    expect(extraMe.status).toBe(401)

    const currentMe = await app.request('/api/auth/me', { headers: { cookie: thirdCookie } })
    expect(currentMe.status).toBe(200)
  })
})

async function adminCookieFor(app: ReturnType<typeof createApp>) {
  return getSessionCookie(await login(app, SEED_SUPER_ADMIN.email, SEED_SUPER_ADMIN.password))
}

function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  return app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

function getSessionCookie(response: Response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
}

async function json(app: ReturnType<typeof createApp>, path: string, init?: RequestInit) {
  const response = await app.request(path, init)
  expect(response.status).toBe(200)
  return response.json()
}
