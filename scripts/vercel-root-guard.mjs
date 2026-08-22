#!/usr/bin/env node
/**
 * Fails a Vercel build that was pointed at the repository root instead of the app.
 *
 * The deployable app lives in `merchant-app/`. The repository root holds only
 * docs and research, so a root-rooted build produces an empty deployment that
 * looks successful in the dashboard and 404s in front of a judge.
 *
 * Vercel reads `vercel.json` from the configured Root Directory only, so this
 * guard (referenced from the root `vercel.json`) can never run — and can never
 * interfere — when Root Directory is correctly set to `merchant-app`.
 */

const RED = '\u001b[31m'
const BOLD = '\u001b[1m'
const RESET = '\u001b[0m'

const lines = [
  '',
  `${RED}${BOLD}Vercel Root Directory is wrong.${RESET}`,
  '',
  'This build ran at the repository root, which contains no application.',
  'The Vite app, its API functions and its vercel.json all live in:',
  '',
  `    ${BOLD}merchant-app${RESET}`,
  '',
  'Fix it in the dashboard (this cannot be set from code):',
  '  1. Vercel -> Project -> Settings -> Build and Deployment',
  '  2. Root Directory -> Edit -> enter: merchant-app',
  '  3. Save, then Deployments -> Redeploy',
  '',
  'Failing the build on purpose so this is caught now and not on stage.',
  '',
]

process.stderr.write(`${lines.join('\n')}\n`)
process.exit(1)
