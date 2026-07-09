import 'server-only'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'
import type { ProcessRecord } from './legislation'

/**
 * Wczytywanie procesów legislacyjnych przy buildzie (statyczny eksport).
 * Pełne rekordy leżą w data/legislation/{num}.json — pisane przez
 * `sync:legislation` (CI) lub `seed` (lokalnie). Wzorzec: lib/data.ts.
 */

const DIR = path.join(process.cwd(), 'data', 'legislation')

let cache: ProcessRecord[] | null = null

function loadAll(): ProcessRecord[] {
  if (cache) return cache
  if (!existsSync(DIR)) {
    cache = []
    return cache
  }
  const records: ProcessRecord[] = []
  for (const file of readdirSync(DIR)) {
    if (!file.endsWith('.json')) continue
    try {
      records.push(JSON.parse(readFileSync(path.join(DIR, file), 'utf8')) as ProcessRecord)
    } catch {
      // pomiń uszkodzony plik
    }
  }
  // Najświeższe procesy najpierw (po dacie zmiany).
  records.sort((a, b) => (b.changeDate > a.changeDate ? 1 : b.changeDate < a.changeDate ? -1 : 0))
  cache = records
  return cache
}

export function getAllProcesses(): ProcessRecord[] {
  return loadAll()
}

export function getProcess(num: string): ProcessRecord | undefined {
  return loadAll().find((p) => p.num === num)
}
