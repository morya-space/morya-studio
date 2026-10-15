/**
 * 数据库初始化脚本：确保表结构完整 + 管理员账号存在。
 * 用法: node scripts/init-db.cjs
 */

const mysql = require('mysql2/promise')
const crypto = require('node:crypto')

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return salt + ':' + hash
}

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST ?? 'mysql6.sqlpub.com',
    port: Number(process.env.MYSQL_PORT ?? 3311),
    database: process.env.MYSQL_DATABASE ?? 'morya_data',
    user: process.env.MYSQL_USER ?? 'morya_admin',
    password: process.env.MYSQL_PASSWORD ?? 'bh4ZGrXLTBY8x9vJ',
    connectTimeout: 10000,
  })
  const conn = await pool.getConnection()
  const ts = now()

  console.log('[init-db] Connected to MySQL')

  // ---- 1. 修复 users 表：添加 avatar 列 ----
  try {
    await conn.query("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''")
    console.log('[init-db] Added avatar column to users')
  } catch (e) {
    if (!e.message.includes('Duplicate')) console.error('[init-db] avatar:', e.message)
  }

  // ---- 2. 创建缺失的表 ----
  const createTables = [
    `CREATE TABLE IF NOT EXISTS workspace_configs (
      owner_id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '{}',
      updated_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      last_seen_at VARCHAR(30) NOT NULL,
      expires_at VARCHAR(30) NOT NULL,
      ip VARCHAR(45),
      user_agent TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS pages (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      \`schema\` TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS datasources (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL,
      config TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS templates (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon VARCHAR(50) NOT NULL DEFAULT 'layout',
      page TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS components (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      base_type VARCHAR(50) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon VARCHAR(50) NOT NULL DEFAULT 'layers',
      config TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS sync_logs (
      id VARCHAR(36) PRIMARY KEY,
      datasource_id VARCHAR(36) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'success',
      rows_synced INT NOT NULL DEFAULT 0,
      message TEXT,
      created_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS password_resets (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      token VARCHAR(64) NOT NULL UNIQUE,
      expires_at VARCHAR(30) NOT NULL,
      created_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ]

  for (const sql of createTables) {
    try {
      await conn.query(sql)
    } catch (e) {
      console.error('[init-db] Table creation error:', e.message.slice(0, 100))
    }
  }
  console.log('[init-db] All tables ensured')

  // ---- 3. 创建 admin 角色 ----
  const PERMISSIONS = [
    'panel:read', 'panel:write',
    'datasource:read', 'datasource:write',
    'connector:use',
    'component:read', 'component:write',
    'template:read', 'template:write',
    'admin:user', 'admin:role',
  ]

  let adminRoleId
  const [adminRoles] = await conn.query('SELECT id FROM roles WHERE name = ?', ['admin'])
  if (adminRoles.length > 0) {
    adminRoleId = adminRoles[0].id
    console.log('[init-db] Admin role exists')
  } else {
    adminRoleId = crypto.randomUUID()
    await conn.query(
      'INSERT INTO roles (id, name, description, is_system, created_at) VALUES (?,?,?,1,?)',
      [adminRoleId, 'admin', '系统管理员，拥有全部权限', ts],
    )
    for (const code of PERMISSIONS) {
      await conn.query('INSERT INTO role_permissions (role_id, code) VALUES (?,?)', [adminRoleId, code])
    }
    console.log('[init-db] Created admin role with all permissions')
  }

  // ---- 4. 创建 member 角色 ----
  const [memberRoles] = await conn.query('SELECT id FROM roles WHERE name = ?', ['member'])
  if (memberRoles.length === 0) {
    const memberRoleId = crypto.randomUUID()
    await conn.query(
      'INSERT INTO roles (id, name, description, is_system, created_at) VALUES (?,?,?,1,?)',
      [memberRoleId, 'member', '普通成员，业务读写', ts],
    )
    const memberPerms = PERMISSIONS.filter(p => !p.startsWith('admin:'))
    for (const code of memberPerms) {
      await conn.query('INSERT INTO role_permissions (role_id, code) VALUES (?,?)', [memberRoleId, code])
    }
    console.log('[init-db] Created member role')
  }

  // ---- 5. 创建管理员用户 ----
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'grealish@teamdek.com'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'studio'
  const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Grealish'

  const [existingAdmin] = await conn.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL])
  if (existingAdmin.length > 0) {
    console.log(`[init-db] Admin user ${ADMIN_EMAIL} already exists`)
    // 确保有 admin 角色
    const [hasRole] = await conn.query(
      'SELECT * FROM user_roles WHERE user_id = ? AND role_id = ?',
      [existingAdmin[0].id, adminRoleId],
    )
    if (hasRole.length === 0) {
      await conn.query('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', [existingAdmin[0].id, adminRoleId])
      console.log('[init-db] Assigned admin role to existing user')
    }
  } else {
    const userId = crypto.randomUUID()
    await conn.query(
      'INSERT INTO users (id, name, email, password_hash, status, created_at) VALUES (?,?,?,?,?,?)',
      [userId, ADMIN_NAME, ADMIN_EMAIL, hashPassword(ADMIN_PASSWORD), 'active', ts],
    )
    await conn.query('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', [userId, adminRoleId])
    console.log(`[init-db] Created admin user: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  }

  // ---- 6. 确保旧用户也有 admin 角色 ----
  const [oldAdmins] = await conn.query('SELECT id FROM users WHERE email = ?', ['admin@morya.local'])
  if (oldAdmins.length > 0) {
    const [hasRole] = await conn.query(
      'SELECT * FROM user_roles WHERE user_id = ? AND role_id = ?',
      [oldAdmins[0].id, adminRoleId],
    )
    if (hasRole.length === 0) {
      await conn.query('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', [oldAdmins[0].id, adminRoleId])
      console.log('[init-db] Assigned admin role to admin@morya.local')
    }
  }

  // ---- 7. 验证 ----
  const [users] = await conn.query(`
    SELECT u.email, u.name, u.status, GROUP_CONCAT(r.name) as roles
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    GROUP BY u.id
  `)
  console.log('[init-db] Users:', JSON.stringify(users, null, 2))

  const [tables] = await conn.query('SHOW TABLES')
  console.log('[init-db] Tables:', tables.map(t => Object.values(t)[0]).join(', '))

  conn.release()
  await pool.end()
  console.log('[init-db] Done!')
}

main().catch(e => {
  console.error('[init-db] FATAL:', e)
  process.exit(1)
})
