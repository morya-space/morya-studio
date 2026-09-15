export class AuthConflictError extends Error {}
export class AuthCredentialsError extends Error {}
export class IdentityNotFoundError extends Error {
  constructor(message = '资源不存在') {
    super(message)
  }
}
export class IdentityForbiddenError extends Error {
  constructor(message = '当前操作不被允许') {
    super(message)
  }
}
export class IdentityValidationError extends Error {
  constructor(message: string) {
    super(message)
  }
}
