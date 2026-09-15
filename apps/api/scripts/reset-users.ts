import { SEED_SUPER_ADMIN } from '@morya-studio/shared'
import { getConfig } from '../src/config/env'
import { createIdentityService } from '../src/services/identity'
import { createMySqlIdentityStore, createMySqlPool } from '../src/services/identity-store'

const config = getConfig()
const pool = createMySqlPool(config)
const connection = await pool.getConnection()

try {
  await connection.query('SET FOREIGN_KEY_CHECKS = 0')
  await connection.query('TRUNCATE TABLE login_events')
  await connection.query('TRUNCATE TABLE sessions')
  await connection.query('TRUNCATE TABLE user_roles')
  await connection.query('TRUNCATE TABLE users')
  await connection.query('SET FOREIGN_KEY_CHECKS = 1')
}
finally {
  connection.release()
}

const identity = createIdentityService(createMySqlIdentityStore(pool))
await identity.bootstrap()
const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users')
const total = Number((rows as Array<{ total: number }>)[0]?.total ?? 0)
await pool.end()

console.log(`Users table reset. Current user count: ${total}`)
console.log(`Built-in super admin: ${SEED_SUPER_ADMIN.email} / ${SEED_SUPER_ADMIN.password}`)
