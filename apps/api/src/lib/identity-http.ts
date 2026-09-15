import type { Context } from 'hono'
import {
  AuthConflictError,
  IdentityForbiddenError,
  IdentityNotFoundError,
  IdentityValidationError,
} from '../services/identity-errors'

export function mapIdentityError(
  c: Context,
  error: unknown,
  conflict: { code?: string; message?: string } = {},
) {
  if (error instanceof AuthConflictError) {
    return c.json({
      error: {
        code: conflict.code ?? 'CONFLICT',
        message: conflict.message ?? '资源已存在',
      },
    }, 409)
  }
  if (error instanceof IdentityNotFoundError)
    return c.json({ error: { code: 'NOT_FOUND', message: error.message } }, 404)
  if (error instanceof IdentityForbiddenError)
    return c.json({ error: { code: 'FORBIDDEN', message: error.message } }, 403)
  if (error instanceof IdentityValidationError)
    return c.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, 400)
  throw error
}
