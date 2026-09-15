import { SEED_SUPER_ADMIN } from '@morya-studio/shared'
import { serve } from '@hono/node-server'
import { createStudio } from './app'
import { getConfig } from './config/env'

const config = getConfig()
const { app, identity } = createStudio(config)
await identity.bootstrap()

serve({ fetch: app.fetch, port: config.PORT })
console.log(`API listening on http://localhost:${config.PORT}`)
console.log(`Built-in super admin: ${SEED_SUPER_ADMIN.email} / ${SEED_SUPER_ADMIN.password}`)
