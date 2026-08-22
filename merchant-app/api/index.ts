import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleDemoApi, json } from '../server/demoApi.js'

function headerString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value) return value
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0]) return value[0]
  return undefined
}

/**
 * Vercel rewrites `/api/:path*` onto this file. Keep `req.url` as the public
 * `/api/...` path so `handleDemoApi` can route. A rewrite that leaves the
 * original URL alone is a no-op here.
 */
function restorePublicUrl(req: IncomingMessage) {
  const current = req.url ?? '/'
  const parsed = new URL(current, 'http://demo.invalid')
  if (parsed.pathname.startsWith('/api/') && parsed.pathname !== '/api/index') return

  const forwarded = headerString(req.headers['x-forwarded-uri'])
    ?? headerString(req.headers['x-forwarded-path'])
  if (forwarded) {
    try {
      const url = forwarded.startsWith('http')
        ? new URL(forwarded)
        : new URL(forwarded, 'http://demo.invalid')
      if (url.pathname.startsWith('/api') && url.pathname !== '/api/index') {
        req.url = `${url.pathname}${url.search}`
        return
      }
    } catch {
      // Fall through to query reconstruction.
    }
  }

  const query = (req as IncomingMessage & { query?: Record<string, string | string[]> }).query
  const fromQuery = query?.path
  if (typeof fromQuery === 'string' && fromQuery && fromQuery !== 'index') {
    const suffix = fromQuery.replace(/^\/+/, '')
    req.url = suffix.startsWith('api/') ? `/${suffix}` : `/api/${suffix}`
    return
  }
  if (Array.isArray(fromQuery) && fromQuery.length) {
    req.url = `/api/${fromQuery.join('/')}`
  }
}

/**
 * Single Vercel function for every `/api/*` route.
 *
 * Vite/static-build does not honour Next-style `api/[...path].ts` catch-alls
 * for multi-segment paths (`/api/a/b` 404s at the platform). `vercel.json`
 * rewrites those onto this file instead.
 *
 * `handleDemoApi` already converts its own faults into JSON, so this is only
 * the last line of defence: it must still answer with JSON (never an HTML
 * error page) if the module itself misbehaves, because the client parses
 * every response as JSON and an HTML 500 reads as a confusing crash.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    restorePublicUrl(req)
    await handleDemoApi(req, res)
  } catch (error) {
    console.error('[api-index]', req.method, req.url, error)
    json(res, 500, {
      error: 'The demo API failed to handle this request.',
      code: 'handler_crash',
      status: 500,
    })
  }
}
