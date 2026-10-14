/**
 * Hono 上下文变量类型。
 */

import type { PublicUser } from '@morya-studio/shared'
import type { AppConfig } from '../config/env'
import type { IdentityService } from '../services/identity'

export type AppBindings = {
  Variables: {
    config: AppConfig
    identity: IdentityService
    user: PublicUser
    sessionId: string
    requestId: string
  }
}
