const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string; code?: string } }
  if (!response.ok) {
    throw new ApiError(body.error?.message ?? '请求失败，请稍后再试', response.status, body.error?.code)
  }
  return body as T
}
