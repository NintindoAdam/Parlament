import { asset } from './asset'

/**
 * Warstwa kliencka widoku „Jak głosowali?" — typy, metadane kategorii głosów
 * i memoizowane pobieranie statycznych plików z public/votings/ (generowanych
 * w CI przez scripts/sync-votings.ts). Wzorzec identyczny jak lib/places.ts.
 * NIE importować niczego serwerowego.
 */

export type VoteCode = 'yes' | 'no' | 'abstain' | 'absent' | 'valid' | 'none'

/** Zgrupowane głosy w pliku szczegółów: y/n/a/x/v = YES/NO/ABSTAIN/ABSENT/VOTE_VALID. */
export interface GroupedVotes {
  y: number[]
  n: number[]
  a: number[]
  x: number[]
  v: number[]
  /** Głosowania listowe: numer opcji (1-based, jako string) → posłowie, którzy ją wybrali. */
  l?: Record<string, number[]>
}

export interface VotingsManifest {
  generatedAt: string
  placeholder: boolean
  term: number
  sittings: { num: number; firstDate: string; lastDate: string; votings: number }[]
}

export interface VotingSummary {
  num: number
  date: string
  title: string
  topic: string
  kind: string
  yes: number
  no: number
  abstain: number
  absent: number
  /** Rodzaj większości z API Sejmu (SIMPLE_MAJORITY / ABSOLUTE_MAJORITY / …). */
  majorityType?: string
  /** Wymagany próg głosów „za" (policzony przez Sejm — koduje np. 231, 276). */
  majorityVotes?: number
  /** Liczba posłów nieuczestniczących w głosowaniu. */
  notParticipating?: number
  /** Liczba oddanych głosów (za+przeciw+wstrzymało). */
  totalVoted?: number
}

export type VoteOutcome = 'passed' | 'rejected' | 'none' | 'unknown'

export interface SittingIndex {
  sitting: number
  votings: VotingSummary[]
}

export interface VotingDetail extends VotingSummary {
  sitting: number
  /** Opisy opcji głosowania listowego (indeks 0 = opcja „1"). */
  options?: string[]
  votes: GroupedVotes
}

export const VOTE_META: Record<VoteCode, { label: string; color: string; order: number }> = {
  yes: { label: 'Za', color: '#059669', order: 1 },
  no: { label: 'Przeciw', color: '#e11d48', order: 2 },
  abstain: { label: 'Wstrzymał(a) się', color: '#d97706', order: 3 },
  absent: { label: 'Nieobecność', color: '#94a3b8', order: 4 },
  valid: { label: 'Głos oddany', color: '#7c5cdb', order: 5 },
  none: { label: 'Poza wykazem', color: '#e2e8f0', order: 6 },
}

/** Rozpakowuje zgrupowane głosy do mapy poseł → kod głosu. */
export function expandVotes(g: GroupedVotes): Record<number, VoteCode> {
  const out: Record<number, VoteCode> = {}
  for (const id of g.y ?? []) out[id] = 'yes'
  for (const id of g.n ?? []) out[id] = 'no'
  for (const id of g.a ?? []) out[id] = 'abstain'
  for (const id of g.x ?? []) out[id] = 'absent'
  for (const id of g.v ?? []) out[id] = 'valid'
  return out
}

/**
 * Widok głosowania listowego z perspektywy jednej opcji/kandydata:
 * yes = poparł(a) tę opcję, no = oddał(a) głos na inną, absent = nieobecny.
 */
export function expandListVotes(g: GroupedVotes, option: string): Record<number, VoteCode> {
  const out: Record<number, VoteCode> = {}
  for (const id of g.v ?? []) out[id] = 'no'
  for (const id of g.l?.[option] ?? []) out[id] = 'yes'
  for (const id of g.x ?? []) out[id] = 'absent'
  return out
}

/**
 * Wynik głosowania z uwzględnieniem wymaganej większości.
 *
 * Priorytet: `majorityVotes` z API (autorytatywny próg policzony przez Sejm —
 * poprawnie koduje np. 231 dla większości bezwzględnej ustawowej liczby posłów
 * czy 276 dla 3/5). Dopiero w razie braku — reguły wg rodzaju większości.
 * Nigdy nie zgadujemy: brak danych → 'unknown'.
 */
export function computeOutcome(v: VotingSummary): VoteOutcome {
  if (v.kind === 'ON_LIST') return 'none'
  if (typeof v.majorityVotes === 'number' && v.majorityVotes > 0) {
    return v.yes >= v.majorityVotes ? 'passed' : 'rejected'
  }
  switch (v.majorityType) {
    case 'SIMPLE_MAJORITY':
      return v.yes > v.no ? 'passed' : 'rejected'
    case 'ABSOLUTE_MAJORITY':
      return v.yes > v.no + v.abstain ? 'passed' : 'rejected'
    default:
      return 'unknown'
  }
}

// Rzeczywiste wartości `majorityType` z API Sejmu (kadencja 10) — potwierdzone
// w logu CI: SIMPLE_MAJORITY, ABSOLUTE_MAJORITY, ABSOLUTE_STATUTORY_MAJORITY,
// STATUTORY_MAJORITY, MAJORITY_THREE_FIFTHS. Pozostałe dodane profilaktycznie.
const MAJORITY_LABELS: Record<string, string> = {
  SIMPLE_MAJORITY: 'większość zwykła',
  ABSOLUTE_MAJORITY: 'większość bezwzględna',
  ABSOLUTE_STATUTORY_MAJORITY: 'większość bezwzględna ustawowej liczby posłów',
  STATUTORY_MAJORITY: 'większość ustawowej liczby posłów',
  QUALIFIED_MAJORITY: 'większość kwalifikowana',
  MAJORITY_THREE_FIFTHS: 'większość kwalifikowana 3/5',
  MAJORITY_TWO_THIRDS: 'większość kwalifikowana 2/3',
}

/** Ludzka etykieta rodzaju większości (bez progu). */
export function majorityLabel(type?: string): string | null {
  if (!type) return null
  return MAJORITY_LABELS[type] ?? type.toLowerCase().replace(/_/g, ' ')
}

export const OUTCOME_META: Record<Exclude<VoteOutcome, 'none'>, { label: string; tone: string }> = {
  passed: { label: 'Przyjęto', tone: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Odrzucono', tone: 'bg-rose-100 text-rose-800' },
  unknown: { label: 'Wynik nieustalony', tone: 'bg-black/[0.06] text-ink-muted' },
}

/** Etykiety kategorii dla widoku opcji głosowania listowego. */
export const LIST_OPTION_LABELS: Partial<Record<VoteCode, string>> = {
  yes: 'Poparł(a)',
  no: 'Inny wybór',
}

export function voteLabel(code: VoteCode, overrides?: Partial<Record<VoteCode, string>>): string {
  return overrides?.[code] ?? VOTE_META[code].label
}

/** Zliczenia kategorii dla legendy (tylko kody obecne w danych + none z mapy sali). */
export function countVotes(votes: Record<number, VoteCode>): Partial<Record<VoteCode, number>> {
  const counts: Partial<Record<VoteCode, number>> = {}
  for (const code of Object.values(votes)) counts[code] = (counts[code] ?? 0) + 1
  return counts
}

// --- Deep link `?g={sitting}-{voting}` --------------------------------------

export function formatVoteParam(sitting: number, voting: number, option?: string | null): string {
  return option ? `${sitting}-${voting}-${option}` : `${sitting}-${voting}`
}

export function parseVoteParam(
  raw: string
): { sitting: number; voting: number; option: string | null } | null {
  const m = /^(\d+)-(\d+)(?:-(\d+))?$/.exec(raw)
  if (!m) return null
  return { sitting: Number(m[1]), voting: Number(m[2]), option: m[3] ?? null }
}

// --- Filtrowanie listy głosowań ---------------------------------------------

const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}

export function foldText(s: string): string {
  return s.toLowerCase().replace(/[ąćęłńóśźż]/g, (ch) => DIACRITICS[ch] ?? ch)
}

export function matchesVoting(v: VotingSummary, query: string): boolean {
  const q = foldText(query.trim())
  if (!q) return true
  return foldText(`${v.title} ${v.topic}`).includes(q)
}

// --- Memoizowane pobieranie -------------------------------------------------

let manifestCache: Promise<VotingsManifest | null> | null = null
const indexCache = new Map<number, Promise<SittingIndex | null>>()
const detailCache = new Map<string, Promise<VotingDetail | null>>()

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(asset(path))
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function fetchVotingsManifest(force = false): Promise<VotingsManifest | null> {
  if (!manifestCache || force) {
    // Nie utrwalaj porażki: gdy fetch zwróci null (błąd sieci / chwilowy 404),
    // wyczyść cache, by kolejne wywołanie spróbowało ponownie.
    const p = fetchJson<VotingsManifest>('/votings/manifest.json').then((v) => {
      if (v == null && manifestCache === p) manifestCache = null
      return v
    })
    manifestCache = p
  }
  return manifestCache
}

export function fetchSittingIndex(sitting: number): Promise<SittingIndex | null> {
  let p = indexCache.get(sitting)
  if (!p) {
    p = fetchJson<SittingIndex>(`/votings/s${sitting}/index.json`).then((v) => {
      if (v == null && indexCache.get(sitting) === p) indexCache.delete(sitting)
      return v
    })
    indexCache.set(sitting, p)
  }
  return p
}

export function fetchVotingDetail(sitting: number, voting: number): Promise<VotingDetail | null> {
  const key = `${sitting}/${voting}`
  let p = detailCache.get(key)
  if (!p) {
    p = fetchJson<VotingDetail>(`/votings/s${sitting}/${voting}.json`).then((v) => {
      if (v == null && detailCache.get(key) === p) detailCache.delete(key)
      return v
    })
    detailCache.set(key, p)
  }
  return p
}
