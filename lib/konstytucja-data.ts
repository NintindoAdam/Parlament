import 'server-only'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { Konstytucja, Rozdzial } from './konstytucja'

/**
 * Wczytywanie tekstu Konstytucji przy buildzie (statyczny eksport). Dane leżą w
 * data/konstytucja.json (commitowane — dokument niezmienny). Wzorzec: lib/data.ts.
 */

const FILE = path.join(process.cwd(), 'data', 'konstytucja.json')

let cache: Konstytucja | null = null

export function getKonstytucja(): Konstytucja | null {
  if (cache) return cache
  if (!existsSync(FILE)) return null
  try {
    cache = JSON.parse(readFileSync(FILE, 'utf8')) as Konstytucja
    return cache
  } catch {
    return null
  }
}

export function getAllRozdzialy(): Rozdzial[] {
  return getKonstytucja()?.rozdzialy ?? []
}

export function getRozdzial(slug: string): Rozdzial | undefined {
  return getAllRozdzialy().find((r) => r.slug === slug)
}
