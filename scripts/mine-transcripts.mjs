// Pulls agent-visible text out of the JSONL transcripts so promises can be
// audited without reading 800 KB of tool payloads by hand.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.argv[2]
const NEEDLE = new RegExp(process.argv[3] ?? '.', 'i')
const MAX = Number(process.argv[4] ?? 400)

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else if (path.endsWith('.jsonl')) out.push(path)
  }
  return out
}

function textOf(node, depth = 0) {
  if (depth > 6 || node == null) return []
  if (typeof node === 'string') return [node]
  if (Array.isArray(node)) return node.flatMap((n) => textOf(n, depth + 1))
  if (typeof node === 'object') {
    const out = []
    for (const key of ['text', 'content', 'summary', 'final_summary', 'message', 'result']) {
      if (key in node) out.push(...textOf(node[key], depth + 1))
    }
    return out
  }
  return []
}

for (const file of walk(ROOT)) {
  const name = file.split('/').pop().replace('.jsonl', '').slice(0, 8)
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)
  for (const [index, line] of lines.entries()) {
    let event
    try { event = JSON.parse(line) } catch { continue }
    const role = event.role ?? event.type ?? ''
    if (/tool|result|output/i.test(String(role))) continue
    for (const chunk of textOf(event)) {
      const clean = chunk.replace(/\s+/g, ' ').trim()
      if (clean.length < 40 || clean.length > 6000) continue
      if (!NEEDLE.test(clean)) continue
      console.log(`\n### ${name}:${index} [${role}]\n${clean.slice(0, MAX)}`)
    }
  }
}
