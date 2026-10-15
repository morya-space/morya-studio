/**
 * 数据库修复脚本：适配现有 schema，确保管理员账号和角色存在。
 * 用法: node scripts/fix-db.cjs
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

  console.log('[fix-db] Connected to MySQL')

  // ---- 1. 添加 avatar 列到 users（如不存在） ----
  try {
    const [cols] = await conn.query("SHOW COLUMNS FROM users LIKE 'avatar'")
    if (cols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN avatar TEXT')
      console.log('[fix-db] Added avatar column to users')
    } else {
      console.log('[fix-db] avatar column already exists')
    }
  } catch (e) {
    console.error('[fix-db] avatar:', e.message)
  }

  // ---- 2. 创建缺失的表 ----
  const missingTables = [
    `CREATE TABLE IF NOT EXISTS workspace_configs (
      owner_id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      data TEXT,
      updated_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS pages (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      \`schema\` TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS templates (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
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
      description TEXT,
      icon VARCHAR(50) NOT NULL DEFAULT 'layers',
      config TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ]

  for (const sql of missingTables) {
    try {
      await conn.query(sql)
    } catch (e) {
      console.error('[fix-db] Table error:', e.message.slice(0, 100))
    }
  }
  console.log('[fix-db] Missing tables ensured')

  // ---- 3. 检查 role_permissions 列名 ----
  const [rpCols] = await conn.query('SHOW COLUMNS FROM role_permissions')
  const rpColNames = rpCols.map(c => c.Field)
  const permCol = rpColNames.includes('permission_code') ? 'permission_code' : 'code'
  console.log(`[fix-db] role_permissions permission column: ${permCol}`)

  // ---- 4. 创建 admin 角色 ----
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
    console.log('[fix-db] Admin role exists:', adminRoleId)
  } else {
    adminRoleId = crypto.randomUUID()
    await conn.query(
      'INSERT INTO roles (id, name, description, is_system, created_at) VALUES (?,?,?,1,?)',
      [adminRoleId, 'admin', '系统管理员，拥有全部权限', ts],
    )
    console.log('[fix-db] Created admin role:', adminRoleId)
  }

  // 确保 admin 角色有权限
  for (const code of PERMISSIONS) {
    try {
      await conn.query(
        `INSERT INTO role_permissions (role_id, ${permCol}) VALUES (?,?)`,
        [adminRoleId, code],
      )
    } catch (e) {
      if (!e.message.includes('Duplicate')) console.error('[fix-db] perm:', code, e.message.slice(0, 60))
    }
  }
  console.log('[fix-db] Admin permissions ensured')

  // ---- 5. 创建 member 角色 ----
  const [memberRoles] = await conn.query('SELECT id FROM roles WHERE name = ?', ['member'])
  if (memberRoles.length === 0) {
    const memberRoleId = crypto.randomUUID()
    await conn.query(
      'INSERT INTO roles (id, name, description, is_system, created_at) VALUES (?,?,?,1,?)',
      [memberRoleId, 'member', '普通成员，业务读写', ts],
    )
    const memberPerms = PERMISSIONS.filter(p => !p.startsWith('admin:'))
    for (const code of memberPerms) {
      try {
        await conn.query(`INSERT INTO role_permissions (role_id, ${permCol}) VALUES (?,?)`, [memberRoleId, code])
      } catch (e) {
        if (!e.message.includes('Duplicate')) console.error('[fix-db] member perm:', e.message.slice(0, 60))
      }
    }
    console.log('[fix-db] Created member role')
  } else {
    console.log('[fix-db] Member role exists')
  }

  // ---- 6. 创建管理员用户 ----
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'grealish@teamdek.com'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'studio'
  const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Grealish'

  const [existingAdmin] = await conn.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL])
  if (existingAdmin.length > 0) {
    console.log(`[fix-db] Admin user ${ADMIN_EMAIL} already exists, id: ${existingAdmin[0].id}`)
    // 确保有 admin 角色
    try {
      await conn.query('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', [existingAdmin[0].id, adminRoleId])
      console.log('[fix-db] Assigned admin role')
    } catch (e) {
      if (!e.message.includes('Duplicate')) console.error('[fix-db] user_role:', e.message.slice(0, 60))
    }
  } else {
    const userId = crypto.randomUUID()
    await conn.query(
      'INSERT INTO users (id, name, email, password_hash, status, created_at) VALUES (?,?,?,?,?,?)',
      [userId, ADMIN_NAME, ADMIN_EMAIL, hashPassword(ADMIN_PASSWORD), 'active', ts],
    )
    await conn.query('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', [userId, adminRoleId])
    console.log(`[fix-db] Created admin user: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  }

  // ---- 7. 确保旧用户也有 admin 角色 ----
  const [oldAdmins] = await conn.query('SELECT id FROM users WHERE email = ?', ['admin@morya.local'])
  if (oldAdmins.length > 0) {
    try {
      await conn.query('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', [oldAdmins[0].id, adminRoleId])
      console.log('[fix-db] Assigned admin role to admin@morya.local')
    } catch (e) {
      if (!e.message.includes('Duplicate')) console.error('[fix-db] old admin role:', e.message.slice(0, 60))
    }
  }

  // ---- 8. 验证 ----
  const [users] = await conn.query(`
    SELECT u.email, u.name, u.status, GROUP_CONCAT(r.name) as roles
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    GROUP BY u.id
  `)
  console.log('\n[fix-db] Users:')
  for (const u of users) {
    console.log(`  ${u.email} (${u.name}) - ${u.status} - roles: ${u.roles ?? 'none'}`)
  }

  const [tables] = await conn.query('SHOW TABLES')
  console.log('\n[fix-db] Tables:', tables.map(t => Object.values(t)[0]).join(', '))

  conn.release()
  await pool.end()
  console.log('\n[fix-db] Done!')
}

main().catch(e => {
  console.error('[fix-db] FATAL:', e)
  process.exit(1)
})
