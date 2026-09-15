import type { AuthUser } from '@morya-studio/shared'
import type { AppConfig } from '../config/env'
import type { IdentityService } from '../services/identity'

export interface AppBindings {
  Variables: {
    requestId: string
    config: AppConfig
    identity: IdentityService
    user?: AuthUser
    sessionId?: string
  }
}
