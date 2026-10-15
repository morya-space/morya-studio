/**
 * Worker 线程：独立执行 MySQL 查询，避免阻塞主线程事件循环。
 * 主线程通过 SharedArrayBuffer + Atomics 同步等待结果。
 */

const { parentPort, workerData } = require('node:worker_threads')
const mysql = require('mysql2/promise')

let pool = null

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: workerData.host,
      port: workerData.port,
      database: workerData.database,
      user: workerData.user,
      password: workerData.password,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: 'utf8mb4',
      connectTimeout: 10000,
    })
  }
  return pool
}

parentPort.on('message', async (msg) => {
  const { sab, port, sql, params } = msg
  const int32 = new Int32Array(sab)

  try {
    const p = await getPool()
    const [rows] = await p.query(sql, params ?? [])
    port.postMessage({ ok: true, rows })
  } catch (e) {
    port.postMessage({ ok: false, error: e.message || String(e) })
  } finally {
    // 无论成功失败，都唤醒主线程
    Atomics.store(int32, 0, 1)
    Atomics.notify(int32, 0)
  }
})
