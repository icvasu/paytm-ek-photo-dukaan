# Deploying to Vercel

Everything deployable lives in `merchant-app/`. The repository root holds only
docs and research and has no `package.json`.

## One setting you must do by hand

**Vercel → Project → Settings → Build and Deployment → Root Directory → `merchant-app`**

This cannot be set from code — it is the setting that tells Vercel where the
project is, so it has to exist before any `vercel.json` is read.

If it is left at the repository root, the root [`vercel.json`](../../vercel.json)
runs [`scripts/vercel-root-guard.mjs`](../../scripts/vercel-root-guard.mjs),
which prints the fix and **fails the build on purpose**. That is deliberate: a
root-rooted build would otherwise "succeed" with an empty output directory and
404 in front of a judge.

The guard can never interfere with a correct deploy, because Vercel reads
`vercel.json` from the configured Root Directory only. With Root Directory set
to `merchant-app`, the root file is never read.

## What `merchant-app/vercel.json` does

| Key | Why |
| --- | --- |
| `framework: vite`, `outputDirectory: dist` | Standard Vite build. |
| `functions: api/**/*.ts` | Makes `api/index.ts` a serverless function, 10s cap. |
| `rewrites` | `/api/:path*` → `api/index.ts` (Vite/static-build does not honour Next-style catch-alls for `/api/a/b`). Then SPA fallback: any non-`/api` path serves `index.html`. |
| `headers` | `no-store` on `/api/*`; long immutable cache on `/tesseract/*`. |

### The rewrite ordering trap

The SPA fallback source is:

```
/((?!api(?:/|$)).*)
```

The negative lookahead is what keeps `/api` and `/api/anything` **out** of the
fallback. Without it the SPA rewrite swallows every API call and the frontend
receives `index.html` where it expected JSON — the classic silent killer.

Two further points:

- `rewrites` (not legacy `routes`) is used deliberately. Vercel applies
  `rewrites` *after* the filesystem check, so real files under `/assets/*` and
  `/tesseract/*` are still served directly even though they match the pattern.
- The lookahead is anchored with `(?:/|$)`, so a future `/apiary` route would
  still get the SPA fallback rather than being wrongly excluded.

The app uses `HashRouter`, so in-app deep links are `/#/dukaan/meena-kirana` and
never hit the server as a path. The rewrite exists so that a *server* path —
someone hand-typing `/dukaan/meena-kirana`, or a stale link — renders the app
instead of a 404.

## Environment variables

All optional. See [`.env.example`](../.env.example) for the authoritative list;
it documents only variables the code actually reads.

| Variable | Scope | Missing-value behaviour |
| --- | --- | --- |
| `VITE_MERCHANT_VPA` | build/client | Falls back to `example.merchant@upi`, a visibly fake placeholder the UI labels as such. Never white-screens. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | server | Shared demo store off; per-instance memory. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | server | Same, alternate names. KV names win. |

Both the URL and the token must be present for shared mode to switch on.

The public project currently has **no server env vars**. `/api/health` is
expected to report `persistence: "instance-memory"` until a KV/Upstash store is
attached in the Vercel dashboard. That is enough for a judged demo: the public
dukaan seeds the sample catalog on a cold instance, and the client also falls
back to that same catalog if the API is unreachable.

## Persistence semantics

`GET /api/health` reports `persistence` as exactly one of:

| Value | Meaning |
| --- | --- |
| `instance-memory` | No shared store configured. State lives in this serverless instance and resets on cold start. |
| `shared-redis` | A shared store is configured **and has actually answered this instance**. |
| `shared-redis-unreachable-using-memory` | A shared store is configured but the last call failed. The API failed over to memory and is telling you so. |

`shared-redis` is only claimed after a real round trip, so health never
optimistically reports durability the demo does not have. `sharedStore.lastError`
carries the reason on failover.

`GET /api/dukaan/meena-kirana` always resolves, even on a cold instance that has
never seen a merchant save: it seeds the sample shop on demand. The response
carries `state` (`seeded-sample` or `merchant-published`) and `persistence`, so
the storefront can be honest about which it is showing rather than implying a
live shop.

## Verifying a deployment

```bash
BASE=https://<your-deployment>.vercel.app

curl -s $BASE/api/health | jq          # expect ok:true and a truthful persistence
curl -s $BASE/api/dukaan/meena-kirana | jq '.items | length'   # expect 12
curl -si $BASE/api/nope | head -1      # expect 404, and JSON, not HTML
curl -si $BASE/dukaan/anything | head -1   # expect 200 index.html, not 404
```

The last two together prove the rewrite ordering is right: API paths still reach
the function, and non-API paths still reach the SPA.

## Local adversarial probes

Both run against the real handler, not a mock:

```bash
npx vite-node server/probeProdApi.mjs        # 11 malformed/unknown/wrong-verb requests
npx vite-node server/probeStoreFailover.mjs  # shared store configured but unreachable
```

`probeProdApi.mjs` mounts `api/index.ts` on a bare `node:http` server. That
matters: the Vite dev server answers CORS preflights itself, which masks whether
the function does.

## Preview builds

`npx vite preview` serves the built SPA only — the Vite API middleware is a dev
plugin and the Vercel function is not running. The app is expected to show its
error state (not a white screen) for anything that needs the API. The public
dukaan and every API-backed screen will report a failed request honestly.
