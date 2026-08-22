import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleDemoApi } from '../server/demoApi.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await handleDemoApi(req, res)
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      error: error instanceof Error ? error.message : 'Demo API error',
    }))
  }
}
