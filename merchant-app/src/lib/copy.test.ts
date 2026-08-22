import { describe, expect, it } from 'vitest'

/**
 * Guards the user-facing wording rules the pitch depends on.
 *
 * The word "demo" was deliberately removed from anything a judge can read on
 * screen: the app should present as a merchant's own Paytm for Business, not as
 * a sales artefact. It kept creeping back through *error* copy — "Could not
 * reach the demo server" — which is exactly the copy most likely to appear on a
 * flaky venue network, in front of the judges. So this scans for it.
 *
 * The rule is scoped to sentences: an identifier like `demoClock` or a storage
 * key like `paytm-merchant-demo-v3` is internal and allowed. A string literal
 * containing whitespace *and* the word is prose, and prose is user-facing until
 * proven otherwise.
 *
 * Loaded through Vite's raw glob rather than `node:fs`, matching
 * sampleAssets.test.ts, so the suite stays inside the app's TypeScript project,
 * which has no Node types.
 */
const appSources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * The API's error strings are rendered verbatim by the client, so they are
 * user-facing copy and fall under the same rule.
 */
const serverSources = import.meta.glob('/server/demoApi.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const files = Object.entries({ ...appSources, ...serverSources })
  .filter(([path]) => !/\.test\.tsx?$/.test(path))

/** Quoted string and template literals that read as prose rather than a key. */
function proseLiterals(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const found = withoutComments.match(/'[^'\n]{4,}'|"[^"\n]{4,}"|`[^`]{4,}`/g) ?? []
  return found
    .map((literal) => literal.slice(1, -1))
    .filter((literal) => /\s/.test(literal))
}

describe('user-facing copy', () => {
  it('finds the source files to scan', () => {
    expect(files.length).toBeGreaterThan(5)
    expect(files.some(([path]) => path.endsWith('server/demoApi.ts'))).toBe(true)
  })

  it('never calls the product a demo in a sentence a judge could read', () => {
    const offenders: string[] = []
    for (const [path, source] of files) {
      for (const literal of proseLiterals(source)) {
        if (/\bdemos?\b/i.test(literal)) {
          offenders.push(`${path}: ${literal.trim().slice(0, 90)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('still labels simulated money movement as simulated', () => {
    const all = files.map(([, source]) => source).join('\n')
    // Dropping the word "demo" must not cost the honesty label it carried.
    expect(/simulated/i.test(all)).toBe(true)
    expect(/no bank API called|simulated payout/i.test(all)).toBe(true)
  })

  it('still says plainly that this is a prototype, not official Paytm', () => {
    const all = files.map(([, source]) => source).join('\n')
    expect(/prototype/i.test(all)).toBe(true)
    expect(/not an official Paytm/i.test(all)).toBe(true)
    expect(/not affiliated with or endorsed by Paytm/i.test(all)).toBe(true)
  })
})
