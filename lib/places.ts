import { asset } from './asset'

/**
 * Wspólna logika wyszukiwarki miejscowości — używana zarówno przez skrypty
 * synchronizacji (Node), jak i przez klienta w przeglądarce. NIE importować
 * niczego serwerowego.
 *
 * Indeks miejscowości jest dzielony na chunki po dwóch pierwszych
 * znormalizowanych literach nazwy (public/places/{xx}.json), dzięki czemu
 * autouzupełnianie pobiera tylko mały fragment bazy (~103 tys. wpisów łącznie).
 */

/** Krotka miejsca w chunku: [nazwa, typ, gmina, powiat, województwo, okręg, nadrzędna?] */
export type PlaceTuple =
  | [string, string, string, string, string, number]
  | [string, string, string, string, string, number, string]

export interface Place {
  name: string
  /** Kod typu: m, w, os, kl, p, ol, cz */
  type: string
  gmina: string
  powiat: string
  voivodeship: string
  okreg: number
  /** Nazwa miejscowości nadrzędnej (dla części miejscowości / przysiółków). */
  parent?: string
}

export interface PlacesManifest {
  generatedAt: string
  placeholder: boolean
  total: number
  chunks: Record<string, number>
}

export const PLACE_TYPE_LABELS: Record<string, string> = {
  m: 'miasto',
  w: 'wieś',
  os: 'osada',
  kl: 'kolonia',
  p: 'przysiółek',
  ol: 'osada leśna',
  cz: 'część miejscowości',
}

/** Ranking typów w podpowiedziach: samodzielne miejscowości przed częściami. */
const TYPE_RANK: Record<string, number> = { m: 0, w: 1, os: 2, kl: 3, p: 4, ol: 5, cz: 6 }

const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}

/**
 * Normalizacja do porównań: małe litery, bez polskich znaków, separatory
 * (spacje/myślniki/apostrofy) sprowadzone do pojedynczej spacji.
 * „Kudowa-Zdrój" → „kudowa zdroj", „Łódź" → „lodz".
 */
export function normalizePlace(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => DIACRITICS[ch] ?? ch)
    .replace(/[-\s']+/g, ' ')
    .trim()
}

/** Klucz chunka: dwa pierwsze znaki znormalizowanej nazwy (tylko [a-z0-9], inaczej „_"). */
export function chunkKey(name: string): string {
  const n = normalizePlace(name).replace(/ /g, '')
  const pick = (ch: string | undefined) => (ch && /[a-z0-9]/.test(ch) ? ch : '_')
  return pick(n[0]) + pick(n[1])
}

export function tupleToPlace(t: PlaceTuple): Place {
  return {
    name: t[0],
    type: t[1],
    gmina: t[2],
    powiat: t[3],
    voivodeship: t[4],
    okreg: t[5],
    parent: t[6],
  }
}

/** Filtruje i porządkuje podpowiedzi dla zapytania (prefiksowo, po normalizacji). */
export function rankSuggestions(entries: PlaceTuple[], query: string, limit = 10): Place[] {
  const q = normalizePlace(query)
  if (q.length < 2) return []
  const matched: { place: Place; exact: boolean; norm: string }[] = []
  for (const t of entries) {
    const norm = normalizePlace(t[0])
    if (norm.startsWith(q)) {
      matched.push({ place: tupleToPlace(t), exact: norm === q, norm })
    }
  }
  matched.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1
    const tr = (TYPE_RANK[a.place.type] ?? 9) - (TYPE_RANK[b.place.type] ?? 9)
    if (tr !== 0) return tr
    const byName = a.norm.localeCompare(b.norm)
    if (byName !== 0) return byName
    return a.place.powiat.localeCompare(b.place.powiat, 'pl')
  })
  return matched.slice(0, limit).map((m) => m.place)
}

/** Parametr URL `?m=` — trójka jednoznacznie wskazująca miejscowość. */
export function formatPlaceParam(p: Place): string {
  return [p.name, p.gmina, p.powiat].join('|')
}

export function parsePlaceParam(raw: string): { name: string; gmina: string; powiat: string } | null {
  const parts = raw.split('|')
  if (parts.length !== 3 || !parts[0]) return null
  return { name: parts[0], gmina: parts[1], powiat: parts[2] }
}

export function matchesPlaceParam(p: Place, param: { name: string; gmina: string; powiat: string }): boolean {
  return (
    normalizePlace(p.name) === normalizePlace(param.name) &&
    normalizePlace(p.gmina) === normalizePlace(param.gmina) &&
    normalizePlace(p.powiat) === normalizePlace(param.powiat)
  )
}

/** Etykieta kontekstu podpowiedzi: „wieś · gm. Kęty, pow. oświęcimski, małopolskie". */
export function placeContextLabel(p: Place): string {
  const type =
    p.type === 'cz' && p.parent
      ? `część m. ${p.parent}`
      : PLACE_TYPE_LABELS[p.type] ?? 'miejscowość'
  return `${type} · gm. ${p.gmina}, pow. ${p.powiat}, ${p.voivodeship}`
}

// ---------------------------------------------------------------------------
// Pobieranie chunków po stronie klienta (memoizowane).

const chunkCache = new Map<string, Promise<PlaceTuple[]>>()
let manifestCache: Promise<PlacesManifest | null> | null = null

export function fetchManifest(): Promise<PlacesManifest | null> {
  if (!manifestCache) {
    manifestCache = fetch(asset('/places/manifest.json'))
      .then((r) => (r.ok ? (r.json() as Promise<PlacesManifest>) : null))
      .catch(() => null)
  }
  return manifestCache
}

export async function fetchChunk(key: string): Promise<PlaceTuple[]> {
  const manifest = await fetchManifest()
  if (manifest && !manifest.chunks[key]) return []
  let p = chunkCache.get(key)
  if (!p) {
    p = fetch(asset(`/places/${key}.json`))
      .then((r) => (r.ok ? (r.json() as Promise<PlaceTuple[]>) : []))
      .catch(() => [])
    chunkCache.set(key, p)
  }
  return p
}
