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
}

export interface SittingIndex {
  sitting: number
  votings: VotingSummary[]
}

export interface VotingDetail extends VotingSummary {
  sitting: number
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

/** Zliczenia kategorii dla legendy (tylko kody obecne w danych + none z mapy sali). */
export function countVotes(votes: Record<number, VoteCode>): Partial<Record<VoteCode, number>> {
  const counts: Partial<Record<VoteCode, number>> = {}
  for (const code of Object.values(votes)) counts[code] = (counts[code] ?? 0) + 1
  return counts
}

// --- Deep link `?g={sitting}-{voting}` --------------------------------------

export function formatVoteParam(sitting: number, voting: number): string {
  return `${sitting}-${voting}`
}

export function parseVoteParam(raw: string): { sitting: number; voting: number } | null {
  const m = /^(\d+)-(\d+)$/.exec(raw)
  if (!m) return null
  return { sitting: Number(m[1]), voting: Number(m[2]) }
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
  if (!manifestCache || force) manifestCache = fetchJson<VotingsManifest>('/votings/manifest.json')
  return manifestCache
}

export function fetchSittingIndex(sitting: number): Promise<SittingIndex | null> {
  let p = indexCache.get(sitting)
  if (!p) {
    p = fetchJson<SittingIndex>(`/votings/s${sitting}/index.json`)
    indexCache.set(sitting, p)
  }
  return p
}

export function fetchVotingDetail(sitting: number, voting: number): Promise<VotingDetail | null> {
  const key = `${sitting}/${voting}`
  let p = detailCache.get(key)
  if (!p) {
    p = fetchJson<VotingDetail>(`/votings/s${sitting}/${voting}.json`)
    detailCache.set(key, p)
  }
  return p
}
