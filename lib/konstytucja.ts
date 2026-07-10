import { asset } from './asset'

/**
 * Typy i pomocnicy Konstytucji RP (klient-safe). Dane pochodzą z jednorazowej
 * ekstrakcji z oficjalnego PDF (scripts/extract-konstytucja.mjs) — tekst wierny.
 */

export interface Punkt {
  nr: string
  text: string
}
export interface Ustep {
  nr: string | null
  text: string
  punkty?: Punkt[]
}
export interface Artykul {
  nr: number
  ustepy: Ustep[]
}
export interface RozdzialElement {
  /** Śródtytuł (oddział) — jeśli obecny. */
  sekcja?: string
  artykul?: Artykul
}
export interface Rozdzial {
  nr: string
  slug: string
  tytul: string
  od: number
  do: number
  elementy: RozdzialElement[]
}
export interface Konstytucja {
  meta: { tytul: string; uchwalona: string; weszla: string; dziennik: string }
  preambula: string
  rozdzialy: Rozdzial[]
}

export interface SearchItem {
  art: number
  roz: string
  text: string
}

/** Kotwica artykułu do deep-linków: #art-30. */
export function artAnchor(nr: number): string {
  return `art-${nr}`
}

const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}

/** Normalizacja do wyszukiwania: małe litery, bez polskich znaków. */
export function foldKonst(s: string): string {
  return s.toLowerCase().replace(/[ąćęłńóśźż]/g, (ch) => DIACRITICS[ch] ?? ch)
}

// --- Pobieranie indeksu wyszukiwania (memoizowane, bez utrwalania porażki) ---

let searchCache: Promise<SearchItem[] | null> | null = null

export function fetchKonstSearch(force = false): Promise<SearchItem[] | null> {
  if (!searchCache || force) {
    const p = fetch(asset('/konstytucja/search.json'))
      .then((r) => (r.ok ? (r.json() as Promise<SearchItem[]>) : null))
      .then((v) => {
        if (v == null && searchCache === p) searchCache = null
        return v
      })
      .catch(() => {
        if (searchCache === p) searchCache = null
        return null
      })
    searchCache = p
  }
  return searchCache
}
