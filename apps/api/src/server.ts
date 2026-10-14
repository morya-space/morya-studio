/**
 * 服务入口：启动 HTTP 服务。
 */

import { serve } from '@hono/node-server'
import { getConfig } from './config/env'
import { createStudio } from './app'

const config = getConfig()
const { app } = createStudio(config)

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`[api] morya-studio-api listening on http://localhost:${info.port}`)
  console.log(`[api] health: http://localhost:${info.port}/health`)
})
