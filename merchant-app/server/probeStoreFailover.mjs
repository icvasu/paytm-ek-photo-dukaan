/**
 * Proves the shared-store failover is honest.
 *
 * Points the API at a Redis REST URL that cannot answer, then checks that the
 * request still succeeds from memory and that /api/health *stops* claiming
 * shared durability. A demo that silently keeps saying "shared-redis" while
 * writing to a dead store is the failure this guards against.
 *
 * Run with:  npx vite-node server/probeStoreFailover.mjs
 */
process.env.KV_REST_API_URL = 'http://127.0.0.1:9/unreachable'
process.env.KV_REST_API_TOKEN = 'not-a-real-token'

const { handleDemoApi } = await import('./demoApi.ts')

const { createServer } = await import('node:http')
const server = createServer((req, res) => { void handleDemoApi(req, res) })
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

const get = async (path) => {
  const started = Date.now()
  const response = await fetch(base + path)
  return { status: response.status, ms: Date.now() - started, body: await response.json() }
}

console.log('Shared store configured but unreachable (127.0.0.1:9)\n')

const health = await get('/api/health')
console.log('GET /api/health      ', health.status, `${health.ms}ms`)
console.log('  persistence:', health.body.persistence)
console.log('  sharedStore:', JSON.stringify(health.body.sharedStore))

const dukaan = await get('/api/dukaan/meena-kirana')
console.log('\nGET /api/dukaan/...  ', dukaan.status, `${dukaan.ms}ms`)
console.log('  items:', dukaan.body.items?.length, '| state:', dukaan.body.state, '| persistence:', dukaan.body.persistence)

const failedOver = health.body.persistence === 'shared-redis-unreachable-using-memory'
const stillServes = dukaan.status === 200 && (dukaan.body.items?.length ?? 0) > 0

console.log(`\n${failedOver ? 'PASS' : 'FAIL'}  health reports the failover instead of claiming shared-redis`)
console.log(`${stillServes ? 'PASS' : 'FAIL'}  public dukaan still serves a full catalog from memory`)

server.close()
process.exit(failedOver && stillServes ? 0 : 1)
