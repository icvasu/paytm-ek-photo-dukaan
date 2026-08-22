/**
 * Adversarial probe of the *production* API path.
 *
 * Mounts `api/index.ts` (the Vercel function) on a bare node:http server,
 * with no Vite middleware in front of it. Vite's dev server answers CORS
 * preflights itself, which hides whether the function does — this does not.
 *
 * Run with:  npx vite-node server/probeProdApi.mjs
 */
import { createServer } from 'node:http'
import handler from '../api/index.ts'

const server = createServer((req, res) => {
  void handler(req, res)
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

const results = []

async function probe(name, path, init = {}) {
  const response = await fetch(base + path, init)
  const text = await response.text()
  results.push({
    name,
    status: response.status,
    contentType: response.headers.get('content-type'),
    cors: response.headers.get('access-control-allow-origin'),
    allow: response.headers.get('allow'),
    body: text.slice(0, 160),
  })
}

const jsonPost = (data) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: data,
})

await probe('unknown route', '/api/definitely-not-a-route')
await probe('CORS preflight (function, not Vite)', '/api/payments', {
  method: 'OPTIONS',
  headers: { Origin: 'https://phone.example', 'Access-Control-Request-Method': 'POST' },
})
await probe('malformed JSON', '/api/payments', jsonPost('{"amountRupees": 12,,,'))
await probe('empty body on mutation', '/api/catalog', { method: 'POST' })
await probe('unknown dukaan slug', '/api/dukaan/no-such-shop')
await probe('known dukaan slug (cold)', '/api/dukaan/meena-kirana')
await probe('health', '/api/health')
await probe('wrong verb', '/api/payments')
await probe('HEAD on a GET route', '/api/health', { method: 'HEAD' })
await probe('deeply nested unknown', '/api/a/b/c/d/e')
await probe('slug with traversal', '/api/dukaan/..%2F..%2Fetc%2Fpasswd')

let bad = 0
for (const r of results) {
  const isJson = (r.contentType ?? '').includes('application/json') || r.status === 204
  const ok = isJson && r.status !== 500
  if (!ok) bad += 1
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(36)} ${String(r.status).padEnd(4)} ` +
    `ct=${r.contentType ?? '-'} cors=${r.cors ?? '-'}${r.allow ? ` allow=${r.allow}` : ''}\n      ${r.body || '(empty body)'}`,
  )
}

server.close()
console.log(`\n${results.length - bad}/${results.length} probes returned JSON with no 500.`)
process.exit(bad ? 1 : 0)
