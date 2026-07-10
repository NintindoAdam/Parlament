import { asset } from './asset'
import { formatVoteParam } from './votings'

/**
 * Proces legislacyjny („Jak powstaje ustawa?") — logika współdzielona przez
 * skrypt synchronizacji (Node) i klienta (przeglądarka). NIE importować tu
 * niczego serwerowego.
 *
 * Surowe etapy z API Sejmu (`stages[]`) mają nieregularne nazwy — normalizujemy
 * je do dziewięciu kanonicznych kroków polskiej ścieżki legislacyjnej, z
 * wyjaśnieniem prostym językiem dla każdego z nich.
 */

// --- Kanoniczne etapy -------------------------------------------------------

export type CanonicalStage =
  | 'inicjatywa'
  | 'i_czytanie'
  | 'komisje'
  | 'ii_czytanie'
  | 'iii_czytanie_glosowanie'
  | 'senat'
  | 'sejm_wobec_senatu'
  | 'prezydent'
  | 'publikacja'

/** Kolejność etapów na osi czasu. */
export const CANONICAL_ORDER: CanonicalStage[] = [
  'inicjatywa',
  'i_czytanie',
  'komisje',
  'ii_czytanie',
  'iii_czytanie_glosowanie',
  'senat',
  'sejm_wobec_senatu',
  'prezydent',
  'publikacja',
]

export interface StageMeta {
  /** Pełna etykieta etapu. */
  label: string
  /** Krótka etykieta (np. do chipów). */
  short: string
  /** Kolor akcentu (spójny z paletą strony). */
  color: string
  /** Wyjaśnienie prostym językiem: co się dzieje i dlaczego to ważne. */
  explain: string
}

export const STAGE_META: Record<CanonicalStage, StageMeta> = {
  inicjatywa: {
    label: 'Inicjatywa ustawodawcza',
    short: 'Inicjatywa',
    color: '#7c5cdb',
    explain:
      'Ktoś składa gotowy projekt ustawy do Sejmu. Prawo do tego mają m.in. rząd, grupa co najmniej 15 posłów, Senat, Prezydent oraz obywatele (potrzeba 100 tys. podpisów). Od kogo pochodzi projekt, często widać już w jego tytule.',
  },
  i_czytanie: {
    label: 'Pierwsze czytanie',
    short: 'I czytanie',
    color: '#2f6fed',
    explain:
      'Projekt zostaje po raz pierwszy przedstawiony — na sali plenarnej albo od razu w komisji. To moment ogólnej debaty: czy w ogóle zajmować się tym pomysłem. Projekt trafia następnie do prac w komisjach.',
  },
  komisje: {
    label: 'Prace w komisjach',
    short: 'Komisje',
    color: '#0e8f8f',
    explain:
      'Najważniejsza, choć mało widoczna część pracy. Posłowie wyspecjalizowani w danej dziedzinie analizują projekt słowo po słowie, wysłuchują ekspertów i zgłaszają poprawki. Efektem jest sprawozdanie komisji dla całego Sejmu.',
  },
  ii_czytanie: {
    label: 'Drugie czytanie',
    short: 'II czytanie',
    color: '#1f9d55',
    explain:
      'Sejm debatuje nad projektem w wersji po pracach komisji. Można tu zgłaszać kolejne poprawki. Jeśli się pojawią, projekt zwykle wraca na chwilę do komisji, by je rozpatrzyć.',
  },
  iii_czytanie_glosowanie: {
    label: 'Trzecie czytanie — głosowanie',
    short: 'III czytanie',
    color: '#059669',
    explain:
      'Kluczowy moment: Sejm głosuje nad całą ustawą. Do jej uchwalenia zwykle wystarcza większość zwykła przy obecności połowy posłów, ale niektóre ustawy wymagają większości bezwzględnej lub kwalifikowanej. Tu widać głos każdego posła z osobna.',
  },
  senat: {
    label: 'Senat',
    short: 'Senat',
    color: '#d97706',
    explain:
      'Uchwaloną ustawą zajmuje się izba wyższa. Senat ma 30 dni: może przyjąć ją bez zmian, wprowadzić poprawki albo odrzucić w całości. Jego decyzja wraca do Sejmu.',
  },
  sejm_wobec_senatu: {
    label: 'Sejm wobec stanowiska Senatu',
    short: 'Sejm ↔ Senat',
    color: '#c2410c',
    explain:
      'Sejm głosuje nad poprawkami lub sprzeciwem Senatu. Poprawkę albo odrzucenie Senatu Sejm może odrzucić bezwzględną większością głosów — jeśli tego nie zrobi, zmiany Senatu wchodzą do ustawy.',
  },
  prezydent: {
    label: 'Prezydent',
    short: 'Prezydent',
    color: '#b91c1c',
    explain:
      'Prezydent ma 21 dni, by podpisać ustawę. Może też odmówić podpisu (weto — Sejm może je odrzucić większością 3/5) albo skierować ustawę do Trybunału Konstytucyjnego, żeby zbadał jej zgodność z Konstytucją.',
  },
  publikacja: {
    label: 'Publikacja w Dzienniku Ustaw',
    short: 'Dziennik Ustaw',
    color: '#334155',
    explain:
      'Podpisana ustawa zostaje ogłoszona w Dzienniku Ustaw. Dopiero od tego momentu — zwykle po okresie „vacatio legis" — prawo obowiązuje wszystkich obywateli.',
  },
}

// --- Inicjator i status -----------------------------------------------------

export type Initiator =
  | 'rzadowy'
  | 'poselski'
  | 'obywatelski'
  | 'senacki'
  | 'prezydencki'
  | 'komisyjny'
  | 'inny'

export const INITIATOR_LABELS: Record<Initiator, string> = {
  rzadowy: 'Projekt rządowy',
  poselski: 'Projekt poselski',
  obywatelski: 'Projekt obywatelski',
  senacki: 'Projekt Senatu',
  prezydencki: 'Projekt Prezydenta',
  komisyjny: 'Projekt komisyjny',
  inny: 'Projekt ustawy',
}

/** Wyprowadza inicjatora z tytułu procesu (API zwykle zaczyna nim tytuł). */
export function deriveInitiator(title: string): Initiator {
  const t = title.toLowerCase()
  if (t.includes('rządow')) return 'rzadowy'
  if (t.includes('obywatelsk')) return 'obywatelski'
  if (t.includes('senack') || t.includes('senatu')) return 'senacki'
  if (t.includes('prezydent')) return 'prezydencki'
  if (t.includes('komisyjn')) return 'komisyjny'
  if (t.includes('poselsk')) return 'poselski'
  return 'inny'
}

export type ProcessStatus = 'w_toku' | 'uchwalona' | 'odrzucona' | 'zakonczona'

export const STATUS_META: Record<ProcessStatus, { label: string; tone: string }> = {
  w_toku: { label: 'W toku', tone: 'bg-blue-100 text-blue-800' },
  uchwalona: { label: 'Uchwalona', tone: 'bg-emerald-100 text-emerald-800' },
  odrzucona: { label: 'Odrzucona', tone: 'bg-rose-100 text-rose-800' },
  zakonczona: { label: 'Zakończona', tone: 'bg-black/[0.06] text-ink-muted' },
}

// --- Typy rekordów ----------------------------------------------------------

export interface VoteRef {
  sitting: number
  voting: number
}

export interface CanonicalStep {
  stage: CanonicalStage
  /** Data etapu (ISO, YYYY-MM-DD) — jeśli znana. */
  date?: string
  /** Rozstrzygnięcie/decyzja tego etapu (surowy opis z API). */
  decision?: string
  /** Referencja do głosowania w Sejmie (III czytanie / rozpatrzenie Senatu). */
  vote?: VoteRef
  /** Oryginalna nazwa etapu z API (diagnostyka/kontekst). */
  raw?: string
}

export interface ProcessRecord {
  num: string
  title: string
  description?: string
  initiator: Initiator
  startDate: string
  changeDate: string
  status: ProcessStatus
  steps: CanonicalStep[]
  /** Główne głosowanie (III czytanie), jeśli się odbyło. */
  finalVote?: VoteRef
  /** Sygnatura w Dzienniku Ustaw / ELI, jeśli opublikowano. */
  dziennikUstaw?: string
  /** Numery druków sejmowych powiązanych z procesem. */
  printNums: string[]
}

export interface ProcessSummary {
  num: string
  title: string
  initiator: Initiator
  status: ProcessStatus
  startDate: string
  /** Ostatni osiągnięty etap (kanoniczny) — do etykiety na kaflu. */
  lastStage: CanonicalStage
  /** Data ostatniego ruchu w procesie (ISO, YYYY-MM-DD). */
  lastActivityDate: string
  /** „Zamrażarka sejmowa": w toku i bez ruchu od ≥ FREEZER_DAYS. */
  frozen: boolean
}

/** Próg „zamrażarki sejmowej" — dni bez ruchu w projekcie będącym w toku. */
export const FREEZER_DAYS = 90

/** Liczba pełnych dni między ostatnim ruchem a datą odniesienia. */
export function daysStale(lastActivityISO: string, nowISO: string): number {
  const a = Date.parse(lastActivityISO.slice(0, 10))
  const b = Date.parse(nowISO.slice(0, 10))
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.floor((b - a) / 86_400_000)
}

/** Czy projekt jest w „zamrażarce": w toku i bez ruchu od ≥ FREEZER_DAYS dni. */
export function isFrozen(status: ProcessStatus, lastActivityISO: string, nowISO: string): boolean {
  return status === 'w_toku' && !!lastActivityISO && daysStale(lastActivityISO, nowISO) >= FREEZER_DAYS
}

export interface LegislationManifest {
  generatedAt: string
  placeholder: boolean
  term: number
  total: number
}

// --- Mapowanie surowych etapów ---------------------------------------------

/**
 * Normalizuje nazwę etapu z API do kanonicznego kroku. Kolejność dopasowań ma
 * znaczenie (III przed II przed I; „rozpatrzenie stanowiska Senatu" przed
 * samym „Senatem"). Nierozpoznane → null (skrypt to zliczy w diagnostyce).
 */
export function mapRawStage(stageName: string): CanonicalStage | null {
  const s = stageName.toLowerCase()
  if (/rozpatr\w*.*(senat|stanowisk)/.test(s) || /(senat|stanowisk).*rozpatr/.test(s))
    return 'sejm_wobec_senatu'
  if (s.includes('prezydent')) return 'prezydent'
  if (s.includes('senat')) return 'senat'
  if (/publik|dziennik ustaw|ogłosz|dz\.?u\.?/.test(s)) return 'publikacja'
  if (/iii czytanie|3 czytanie|trzecie czytanie|głosowanie/.test(s)) return 'iii_czytanie_glosowanie'
  if (/ii czytanie|2 czytanie|drugie czytanie/.test(s)) return 'ii_czytanie'
  if (/komisj/.test(s)) return 'komisje'
  if (/i czytanie|1 czytanie|pierwsze czytanie/.test(s)) return 'i_czytanie'
  if (/wpłyn|inicjatyw|skierowano|projekt wniesiony|uzasadnienie/.test(s)) return 'inicjatywa'
  return null
}

/** Link do widoku „Jak głosowali?" dla danego głosowania (deep-link ?g=). */
export function voteHref(v: VoteRef): string {
  return `/?g=${formatVoteParam(v.sitting, v.voting)}`
}

/** Data w formacie DD.MM.RRRR (albo pusty string). */
export function formatDate(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return ''
  return `${d}.${m}.${y}`
}

// --- Pobieranie po stronie klienta (memoizowane, bez utrwalania porażki) ----

let manifestCache: Promise<LegislationManifest | null> | null = null
let listCache: Promise<ProcessSummary[] | null> | null = null

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(asset(path))
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function fetchLegislationManifest(force = false): Promise<LegislationManifest | null> {
  if (!manifestCache || force) {
    const p = fetchJson<LegislationManifest>('/legislation/manifest.json').then((v) => {
      if (v == null && manifestCache === p) manifestCache = null
      return v
    })
    manifestCache = p
  }
  return manifestCache
}

export function fetchLegislationList(force = false): Promise<ProcessSummary[] | null> {
  if (!listCache || force) {
    const p = fetchJson<ProcessSummary[]>('/legislation/list.json').then((v) => {
      if (v == null && listCache === p) listCache = null
      return v
    })
    listCache = p
  }
  return listCache
}

const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}

/** Normalizacja do wyszukiwania: małe litery, bez polskich znaków. */
export function foldLegislation(s: string): string {
  return s.toLowerCase().replace(/[ąćęłńóśźż]/g, (ch) => DIACRITICS[ch] ?? ch)
}

/** Czy podsumowanie pasuje do zapytania (substring po tytule, po normalizacji). */
export function matchesProcess(p: ProcessSummary, query: string): boolean {
  const q = foldLegislation(query.trim())
  if (!q) return true
  return foldLegislation(`${p.title} ${p.num}`).includes(q)
}
