const DEFAULT_TIMEOUT_MS = 12_000

export class ApiError extends Error {
  readonly status: number
  /** True when the request never reached the server: offline, DNS, timeout. */
  readonly offline: boolean

  constructor(message: string, status: number, offline: boolean) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.offline = offline
  }
}

/**
 * `navigator.onLine` is read defensively: the ambient Navigator type depends on
 * which lib wins in this project, and a missing property must degrade to the
 * generic message rather than fail the build or throw at runtime.
 */
function isKnownOffline(): boolean {
  if (typeof navigator === 'undefined') return false
  return (navigator as { onLine?: boolean }).onLine === false
}

function offlineMessage() {
  return isKnownOffline()
    ? 'You are offline. Reconnect and try again.'
    : 'Could not reach the server. Check the network and try again.'
}

/**
 * JSON fetch with a hard timeout and a truthful error for every failure mode.
 *
 * Callers must await this before showing success. Nothing here retries silently
 * or swallows an error, so the UI can never claim a write that did not land.
 */
export async function apiJson<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(path, { ...init, signal: controller.signal })
    const text = await response.text()
    let payload: (T & { error?: string }) | null = null
    if (text) {
      try {
        payload = JSON.parse(text) as T & { error?: string }
      } catch {
        throw new ApiError(
          response.ok
            ? 'The server sent a response the app could not read.'
            : `The server returned ${response.status}.`,
          response.status,
          false,
        )
      }
    }
    if (!response.ok) {
      throw new ApiError(payload?.error ?? `Request failed (${response.status}).`, response.status, false)
    }
    return payload as T
  } catch (reason) {
    if (reason instanceof ApiError) throw reason
    if (reason instanceof DOMException && reason.name === 'AbortError') {
      throw new ApiError(`The server did not answer within ${Math.round(timeoutMs / 1000)}s. Try again.`, 0, true)
    }
    throw new ApiError(offlineMessage(), 0, true)
  } finally {
    globalThis.clearTimeout(timer)
  }
}
