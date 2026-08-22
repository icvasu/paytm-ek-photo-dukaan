import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleDemoApi, json } from '../server/demoApi.js'

/**
 * Vercel catch-all for every `/api/*` route.
 *
 * `handleDemoApi` already converts its own faults into JSON, so this is only
 * the last line of defence: it must still answer with JSON (never an HTML
 * error page) if the module itself misbehaves, because the client parses
 * every response as JSON and an HTML 500 reads as a confusing crash.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await handleDemoApi(req, res)
  } catch (error) {
    console.error('[api-catch-all]', req.method, req.url, error)
    json(res, 500, {
      error: 'The demo API failed to handle this request.',
      code: 'handler_crash',
      status: 500,
    })
  }
}
