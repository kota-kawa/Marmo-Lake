const API_BASE = '/api'

export class APIError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

type RequestOptions = RequestInit & { skipJson?: boolean }

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const isForm = options.body instanceof FormData
  if (!isForm && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const csrf = csrfToken()
  if (csrf && options.method && options.method !== 'GET') {
    headers.set('X-CSRF-Token', csrf)
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })
  if (!response.ok) {
    let message = response.statusText
    try {
      const data = (await response.json()) as { detail?: string }
      message = data.detail || message
    } catch {
      // keep status text
    }
    throw new APIError(response.status, message)
  }
  if (response.status === 204 || options.skipJson) {
    return undefined as T
  }
  return (await response.json()) as T
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function patchJson<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteRequest(path: string): Promise<void> {
  return apiFetch<void>(path, { method: 'DELETE' })
}

