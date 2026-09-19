#!/usr/bin/env node
/**
 * Fails if any VITE_* variable the source actually reads is missing or blank.
 *
 * `vite build` does not care: it inlines `import.meta.env.VITE_FOO` as
 * `undefined` and exits 0. The breakage only shows up in the browser, and in
 * the case of VITE_FIREBASE_API_KEY it is total -- src/firebase.js throws while
 * the module is still evaluating, and main.jsx imports it at the top, so every
 * route renders a blank page. A green build proves nothing about this.
 *
 * The required list is derived by scanning the source rather than hard-coded,
 * so a newly introduced variable is covered the moment someone reads it.
 *
 * Usage:
 *   node scripts/check-env.ts [--dir=src]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */

/** Only these extensions can contain an import.meta.env reference. */
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])

const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.git'])

const ENV_REFERENCE = /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g

/* ------------------------------------------------------------------ *
 * Scanning
 * ------------------------------------------------------------------ */

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRECTORIES.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path))
    } else if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      found.push(path)
    }
  }
  return found
}

/** Every VITE_* name the source reads, mapped to the files that read it. */
function referencedVars(dir: string): Map<string, string[]> {
  const refs = new Map<string, string[]>()
  for (const file of sourceFiles(dir)) {
    const contents = readFileSync(file, 'utf8')
    for (const match of contents.matchAll(ENV_REFERENCE)) {
      const name = match[1]
      const readers = refs.get(name) ?? []
      readers.push(file)
      refs.set(name, readers)
    }
  }
  return refs
}

/**
 * Vite loads .env itself, but this script runs before/outside the build, so it
 * has to do the same lookup. Real environment variables win, matching Vite.
 */
function loadDotEnv(path: string): Record<string, string> {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return {}
  }

  const values: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    values[key] = value
  }
  return values
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

const dirArg = process.argv.find((a) => a.startsWith('--dir='))
const sourceDir = resolve(process.cwd(), dirArg ? dirArg.slice('--dir='.length) : 'src')

const referenced = referencedVars(sourceDir)
if (referenced.size === 0) {
  console.log('check-env: no VITE_* variables referenced, nothing to verify')
  process.exit(0)
}

const dotEnv = loadDotEnv(resolve(process.cwd(), '.env'))
const missing: string[] = []

for (const name of [...referenced.keys()].sort()) {
  const value = process.env[name] ?? dotEnv[name]
  if (value === undefined || value === '') missing.push(name)
}

if (missing.length > 0) {
  console.error(`check-env: ${missing.length} required variable(s) missing or blank:\n`)
  for (const name of missing) {
    console.error(`  ${name}`)
    for (const reader of referenced.get(name)!) console.error(`    read by ${reader}`)
  }
  console.error('\nSet them in .env (local) or as repository secrets (CI).')
  process.exit(1)
}

console.log(`check-env: all ${referenced.size} referenced VITE_* variable(s) present`)
