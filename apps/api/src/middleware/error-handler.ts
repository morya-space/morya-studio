import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  AuthConflictError,
  AuthCredentialsError,
  IdentityForbiddenError,
  IdentityNotFoundError,
  IdentityValidationError,
} from '../services/identity-errors'

export const errorHandler: ErrorHandler = (error, context) => {
  const requestId = context.get('requestId')
  if (error instanceof HTTPException) {
    return context.json({ error: { code: 'REQUEST_ERROR', message: error.message, requestId } }, error.status)
  }
  if (error instanceof AuthConflictError) {
    return context.json({ error: { code: 'CONFLICT', message: '资源已存在', requestId } }, 409)
  }
  if (error instanceof AuthCredentialsError) {
    return context.json({ error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码不正确', requestId } }, 401)
  }
  if (error instanceof IdentityNotFoundError) {
    return context.json({ error: { code: 'NOT_FOUND', message: error.message, requestId } }, 404)
  }
  if (error instanceof IdentityForbiddenError) {
    return context.json({ error: { code: 'FORBIDDEN', message: error.message, requestId } }, 403)
  }
  if (error instanceof IdentityValidationError) {
    return context.json({ error: { code: 'VALIDATION_ERROR', message: error.message, requestId } }, 400)
  }

  console.error({ requestId, error })
  return context.json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error', requestId } }, 500)
}
