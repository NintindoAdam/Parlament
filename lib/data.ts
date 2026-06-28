import 'server-only'
import { promises as fs } from 'fs'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { clubOrder, getClubMeta } from './clubs'
import { buildClubCounts, generateSeed } from './seed'
import { computeHemicycle } from './seating'
import type { ClubCount, DataMeta, MP, SeatedMP, SeatLayout, WikiInfo } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')

function readJsonSync<T>(file: string): T | null {
  const full = path.join(DATA_DIR, file)
  if (!existsSync(full)) return null
  try {
    return JSON.parse(readFileSync(full, 'utf8')) as T
  } catch {
    return null
  }
}

interface LoadedData {
  mps: MP[]
  clubs: ClubCount[]
  meta: DataMeta
}

let cache: LoadedData | null = null

function load(): LoadedData {
  if (cache) return cache

  const mps = readJsonSync<MP[]>('mps.json')
  if (mps && mps.length > 0) {
    const clubsRaw = readJsonSync<ClubCount[]>('clubs.json')
    const clubs = clubsRaw && clubsRaw.length > 0 ? clubsRaw : buildClubCounts(mps)
    const meta =
      readJsonSync<DataMeta>('meta.json') ??
      ({ placeholder: false, generatedAt: '', term: 10, asOf: '' } as DataMeta)
    cache = { mps, clubs, meta }
  } else {
    // Brak zsynchronizowanych danych — używamy zestawu demonstracyjnego.
    cache = generateSeed()
  }
  return cache
}

export function getMeta(): DataMeta {
  return load().meta
}

/** Posłowie z aktualnie aktywnym mandatem (API zwraca też byłych z całej kadencji). */
function getActiveMPs(): MP[] {
  return load().mps.filter((m) => m.active)
}

export function getClubCounts(): ClubCount[] {
  // Liczymy tylko aktywne mandaty, aby suma odpowiadała 460 obecnym posłom.
  return buildClubCounts(getActiveMPs())
}

export function getAllMPs(): MP[] {
  return load().mps
}

export function getMP(id: number): MP | undefined {
  return load().mps.find((m) => m.id === id)
}

/** Aktywni posłowie posortowani wg sceny politycznej, a w obrębie klubu alfabetycznie. */
export function getOrderedMPs(): MP[] {
  return [...getActiveMPs()].sort((a, b) => {
    const byClub = clubOrder(a.club) - clubOrder(b.club)
    if (byClub !== 0) return byClub
    return a.lastName.localeCompare(b.lastName, 'pl')
  })
}

/** Łączy posortowanych posłów z wyliczonymi pozycjami miejsc w hemicyklu. */
export function getSeating(): { layout: SeatLayout; seated: SeatedMP[] } {
  const ordered = getOrderedMPs()
  const layout = computeHemicycle(ordered.length)
  const seated: SeatedMP[] = ordered.map((mp, index) => ({
    mp,
    seat: layout.seats[index],
    index,
  }))
  return { layout, seated }
}

export async function getWiki(id: number): Promise<WikiInfo | null> {
  const full = path.join(DATA_DIR, 'wiki', `${id}.json`)
  try {
    const raw = await fs.readFile(full, 'utf8')
    const parsed = JSON.parse(raw) as WikiInfo
    if (parsed && parsed.extract) return parsed
    return null
  } catch {
    return null
  }
}

export { getClubMeta }
