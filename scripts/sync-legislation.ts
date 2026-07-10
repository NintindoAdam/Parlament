/**
 * Proces legislacyjny („Jak powstaje ustawa?") — pobieranie, cache i emisja.
 *
 * Dla kadencji pobiera listę procesów (/processes) i szczegóły każdego
 * (/processes/{num}) z tablicą etapów `stages[]`. Surowe etapy normalizujemy do
 * kanonicznej ścieżki (lib/legislation.mapRawStage). Produkty:
 *
 *  1. public/legislation/manifest.json + list.json — wyszukiwarka na landingu,
 *  2. data/legislation/{num}.json — pełne rekordy czytane przy buildzie
 *     (statyczne strony /ustawa/{num}).
 *
 * Uruchomienie:  npm run sync:legislation      Konfiguracja: SEJM_TERM (dom. 10).
 *
 * API bywa nieregularne — skrypt jest odporny na braki pól, a na końcu logu
 * wypisuje diagnostykę (odrębne nazwy etapów, statusy, przykłady), by
 * potwierdzić/uzupełnić mapowanie na realnych danych.
 */
import { promises as fs } from 'fs'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import {
  CANONICAL_ORDER,
  deriveInitiator,
  isFrozen,
  mapRawStage,
  type CanonicalStage,
  type CanonicalStep,
  type Initiator,
  type ProcessRecord,
  type ProcessStatus,
  type ProcessSummary,
  type VoteRef,
} from '../lib/legislation'

const TERM = Number(process.env.SEJM_TERM ?? '10')
const API = `https://api.sejm.gov.pl/sejm/term${TERM}`
const UA = 'Parlament-app/1.0 (https://github.com/NintindoAdam/Parlament; educational)'

const ROOT = process.cwd()
const CACHE_DIR = path.join(ROOT, 'data', 'legislation-cache')
const DATA_DIR = path.join(ROOT, 'data', 'legislation')
const OUT_DIR = path.join(ROOT, 'public', 'legislation')
const VOTINGS_DIR = path.join(ROOT, 'public', 'votings')
const DIAG_FILE = path.join(ROOT, 'data', 'legislation-diag.txt')

const CACHE_SCHEMA = 2
const TITLE_MAX = 400

interface RawStage {
  stageName?: string
  name?: string
  stageType?: string
  date?: string
  decision?: string
  comment?: string
  sitting?: number
  sittingNum?: number
  votingNumber?: number
  votingNum?: number
  voting?: { sitting?: number; sittingNum?: number; votingNumber?: number; votingNum?: number; number?: number }
  votings?: { sitting?: number; sittingNum?: number; votingNumber?: number; votingNum?: number; number?: number }[]
  children?: RawStage[]
}

interface RawProcessListItem {
  number?: string | number
  title?: string
  description?: string
  documentType?: string
  processStartDate?: string
  changeDate?: string
}

interface RawProcessDetail extends RawProcessListItem {
  stages?: RawStage[]
  printNumbers?: (string | number)[]
  prints?: { number?: string | number }[]
}

interface ProcCache {
  schema: number
  changeDate: string
  record: ProcessRecord
}

async function fetchJson<T>(url: string): Promise<T | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as T
    } catch (err) {
      if (attempt === 3) throw new Error(`${(err as Error).message} dla ${url}`)
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
  return null
}

/** Normalizuje odpowiedź /processes do tablicy (API bywa opakowane). */
function asArray(raw: unknown): RawProcessListItem[] {
  if (Array.isArray(raw)) return raw as RawProcessListItem[]
  const o = raw as Record<string, unknown> | null
  return ((o?.items ?? o?.processes ?? o?.data ?? []) as RawProcessListItem[]) ?? []
}

/**
 * Pobiera pełną listę procesów. Endpoint /processes bywa ograniczony domyślnym
 * limitem, więc stronicujemy przez ?limit&offset i deduplikujemy po numerze.
 * Odporne na API, które ignoruje offset (przerywa, gdy nic nowego nie dochodzi).
 */
async function fetchAllProcesses(): Promise<RawProcessListItem[]> {
  const LIMIT = 100
  const seen = new Set<string>()
  const all: RawProcessListItem[] = []
  for (let offset = 0; offset <= 20000; offset += LIMIT) {
    const page = asArray(await fetchJson<unknown>(`${API}/processes?limit=${LIMIT}&offset=${offset}`))
    if (page.length === 0) break
    let added = 0
    for (const item of page) {
      const num = item.number != null ? String(item.number) : ''
      if (!num || seen.has(num)) continue
      seen.add(num)
      all.push(item)
      added++
    }
    if (page.length < LIMIT) break // ostatnia (niepełna) strona
    if (added === 0) break // API zignorowało offset — brak nowych rekordów
  }
  // Awaryjnie: gdyby stronicowanie zwróciło pustkę, spróbuj gołego endpointu.
  if (all.length === 0) return asArray(await fetchJson<unknown>(`${API}/processes`))
  return all
}

async function pool<T>(items: T[], size: number, worker: (item: T, i: number) => Promise<void>) {
  let i = 0
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      await worker(items[idx], idx)
    }
  })
  await Promise.all(runners)
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s)

/** Diagnostyka: zbiór odrębnych, nierozpoznanych i wszystkich nazw etapów. */
const stageNames = new Map<string, number>()
const unknownStages = new Map<string, number>()
let rejNoTitle = 0
let rejNoUstaw = 0
let rejNoSteps = 0
/** Przykładowe surowe szczegóły (do wglądu w kształt API przy pierwszym runie). */
let rawSample: string | null = null

/** Wyciąga referencję do głosowania z etapu (kilka możliwych kształtów API). */
function extractVote(stage: RawStage): VoteRef | undefined {
  const cand = [
    stage.voting,
    ...(stage.votings ?? []),
    { sittingNum: stage.sittingNum, votingNum: stage.votingNum },
    { sitting: stage.sitting, votingNumber: stage.votingNumber },
  ]
  for (const c of cand) {
    if (!c) continue
    const src = c as { sitting?: number; sittingNum?: number; votingNumber?: number; votingNum?: number; number?: number }
    const sitting = src.sittingNum ?? src.sitting
    const voting = src.votingNum ?? src.votingNumber ?? src.number
    if (typeof sitting === 'number' && typeof voting === 'number') return { sitting, voting }
  }
  return undefined
}

/** Spłaszcza etap + dzieci do listy kanonicznych kroków. */
function collectSteps(stages: RawStage[], out: CanonicalStep[]) {
  for (const st of stages) {
    const name = (st.stageName ?? st.name ?? '').trim()
    if (name) {
      stageNames.set(name, (stageNames.get(name) ?? 0) + 1)
      const stage = mapRawStage(name)
      if (stage) {
        out.push({
          stage,
          date: st.date ? st.date.slice(0, 10) : undefined,
          decision: st.decision ? clip(st.decision.trim(), 160) : undefined,
          vote: extractVote(st),
          raw: name,
        })
      } else {
        unknownStages.set(name, (unknownStages.get(name) ?? 0) + 1)
      }
    }
    if (st.children?.length) collectSteps(st.children, out)
  }
}

/** Najpóźniejsza data ruchu w procesie (ISO YYYY-MM-DD). */
function lastStepDate(r: ProcessRecord): string {
  let max = ''
  for (const s of r.steps) if (s.date && s.date > max) max = s.date
  return max || (r.changeDate || r.startDate || '').slice(0, 10)
}

/** Scala kroki do jednego na etap kanoniczny (ostatnia data/decyzja wygrywa). */
function mergeSteps(raw: CanonicalStep[]): CanonicalStep[] {
  const byStage = new Map<CanonicalStage, CanonicalStep>()
  for (const step of raw) {
    const prev = byStage.get(step.stage)
    if (!prev) {
      byStage.set(step.stage, { ...step })
      continue
    }
    // Zachowaj najpóźniejszą datę, pierwszą referencję głosowania i decyzję.
    if (step.date && (!prev.date || step.date > prev.date)) prev.date = step.date
    if (!prev.vote && step.vote) prev.vote = step.vote
    if (step.decision) prev.decision = step.decision
  }
  return CANONICAL_ORDER.filter((s) => byStage.has(s)).map((s) => byStage.get(s)!)
}

/** Wszystkie surowe nazwy etapów (z dziećmi), małymi literami — do statusu. */
function allStageNames(stages: RawStage[], out: string[]) {
  for (const st of stages) {
    const n = (st.stageName ?? st.name ?? '').toLowerCase()
    if (n) out.push(n)
    if (st.children?.length) allStageNames(st.children, out)
  }
}

/**
 * Status procesu wyprowadzony z pełnej listy nazw etapów (API nie ma etapu
 * „Publikacja"; ustawa jest prawem po podpisie Prezydenta).
 */
function deriveStatus(names: string[]): ProcessStatus {
  const has = (re: RegExp) => names.some((n) => re.test(n))
  if (has(/podpisał ustawę/)) return 'uchwalona'
  if (has(/nie uchwalona ponownie/)) return 'odrzucona' // weto utrzymane
  if (has(/wycofano/)) return 'zakonczona'
  if (has(/weto/) || has(/trybuna/)) return 'zakonczona' // u Prezydenta/TK — w toku poza Sejmem
  if (has(/odrzucono/) && !has(/senat/) && !has(/prezydent/)) return 'odrzucona' // odrzucono w czytaniu
  if (has(/prezydent/)) return 'zakonczona'
  return 'w_toku'
}

function normalize(detail: RawProcessDetail): ProcessRecord | null {
  const num = detail.number != null ? String(detail.number) : ''
  const title = clip((detail.title ?? '').trim(), TITLE_MAX)
  if (!num || !title) {
    rejNoTitle++
    return null
  }
  if (!/ustaw/i.test(title)) {
    rejNoUstaw++
    return null // skupiamy się na projektach ustaw
  }

  const raw: CanonicalStep[] = []
  collectSteps(detail.stages ?? [], raw)
  // Zapamiętaj jeden surowy przykład z etapami do diagnostyki kształtu API.
  if (!rawSample && (detail.stages?.length ?? 0) > 0) {
    rawSample = JSON.stringify(detail.stages?.slice(0, 3))?.slice(0, 900) ?? null
  }
  const steps = mergeSteps(raw)
  if (steps.length === 0) {
    rejNoSteps++
    return null
  }

  const names: string[] = []
  allStageNames(detail.stages ?? [], names)
  const status = deriveStatus(names)
  // API nie zwraca etapu „Publikacja", ale podpisana ustawa JEST ogłaszana —
  // dodaj syntetyczny krok, by oś kończyła się poprawnie dla obowiązujących ustaw.
  if (status === 'uchwalona' && !steps.some((s) => s.stage === 'publikacja')) {
    steps.push({ stage: 'publikacja', decision: 'ustawa ogłoszona w Dzienniku Ustaw' })
  }

  const glosowanie = steps.find((s) => s.stage === 'iii_czytanie_glosowanie')
  const prints = (detail.printNumbers ?? detail.prints?.map((p) => p.number) ?? [])
    .filter((p): p is string | number => p != null)
    .map(String)

  return {
    num,
    title,
    description: detail.description ? clip(detail.description.trim(), 600) : undefined,
    initiator: deriveInitiator(title) as Initiator,
    startDate: (detail.processStartDate ?? '').slice(0, 10),
    changeDate: (detail.changeDate ?? detail.processStartDate ?? '').slice(0, 19),
    status,
    steps,
    finalVote: glosowanie?.vote,
    printNums: [...new Set([num, ...prints])],
  }
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
  await fs.mkdir(DATA_DIR, { recursive: true })

  console.log(`→ Pobieranie listy procesów legislacyjnych (kadencja ${TERM})…`)
  const list = await fetchAllProcesses()
  console.log(`  Procesów na liście (łącznie): ${list.length}`)
  if (list.length === 0) {
    // Nie blokuj całego deployu — wyemituj pustą listę i zapisz diagnostykę.
    await emitEmpty()
    await writeDiagnostics([])
    console.warn('⚠ /processes zwróciło pustą listę — pomijam legislację w tym przebiegu.')
    return
  }

  const records: ProcessRecord[] = []
  let fetched = 0
  let cachedHits = 0

  await pool(list, 8, async (item) => {
    const num = item.number != null ? String(item.number) : ''
    if (!num) return
    const changeDate = (item.changeDate ?? '').slice(0, 19)
    const cachePath = path.join(CACHE_DIR, `proc-${num}.json`)

    let rec: ProcessRecord | null = null
    if (existsSync(cachePath)) {
      try {
        const c = JSON.parse(readFileSync(cachePath, 'utf8')) as ProcCache
        if (c.schema === CACHE_SCHEMA && c.changeDate === changeDate) {
          rec = c.record
          cachedHits++
        }
      } catch {
        // uszkodzony cache — pobierz ponownie
      }
    }
    if (!rec) {
      const detail = await fetchJson<RawProcessDetail>(`${API}/processes/${num}`)
      if (!detail) return
      // Uzupełnij pola z listy, gdy brakuje w szczegółach.
      const merged: RawProcessDetail = { ...item, ...detail }
      // collectSteps aktualizuje globalne liczniki nazw etapów — wołane w normalize.
      rec = normalize(merged)
      fetched++
      if (rec) {
        const cache: ProcCache = { schema: CACHE_SCHEMA, changeDate, record: rec }
        await fs.writeFile(cachePath, JSON.stringify(cache))
      }
    } else {
      // Odtwórz liczniki diagnostyki także z cache (nazwy surowe nie są w rekordzie).
      for (const s of rec.steps) if (s.raw) stageNames.set(s.raw, (stageNames.get(s.raw) ?? 0) + 1)
    }
    if (rec) records.push(rec)
  })

  console.log(`  Zapisane procesy (ustawy): ${records.length} (pobrano: ${fetched}, z cache: ${cachedHits})`)

  // Emisja: pełne rekordy + manifest + lista podsumowań.
  await fs.rm(DATA_DIR, { recursive: true, force: true })
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.rm(OUT_DIR, { recursive: true, force: true })
  await fs.mkdir(OUT_DIR, { recursive: true })

  records.sort((a, b) => (b.changeDate > a.changeDate ? 1 : b.changeDate < a.changeDate ? -1 : 0))
  for (const rec of records) {
    await fs.writeFile(path.join(DATA_DIR, `${rec.num}.json`), JSON.stringify(rec))
  }
  const nowISO = new Date().toISOString()
  let frozenCount = 0
  const summaries: ProcessSummary[] = records.map((r) => {
    const lastActivityDate = lastStepDate(r)
    const frozen = isFrozen(r.status, lastActivityDate, nowISO)
    if (frozen) frozenCount++
    return {
      num: r.num,
      title: r.title,
      initiator: r.initiator,
      status: r.status,
      startDate: r.startDate,
      lastStage: r.steps[r.steps.length - 1]?.stage ?? 'inicjatywa',
      lastActivityDate,
      frozen,
    }
  })
  const generatedAt = readGeneratedAt()
  await fs.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ generatedAt, placeholder: false, term: TERM, total: records.length })
  )
  await fs.writeFile(path.join(OUT_DIR, 'list.json'), JSON.stringify(summaries))

  // Diagnostykę zapisujemy ZAWSZE, także przy słabym wyniku — to ona pozwala
  // uzupełnić mapowanie etapów. Legislacja jest izolowaną, nową sekcją, więc
  // NIE blokujemy całego deployu; problemy jakości danych to ostrzeżenia.
  await writeDiagnostics(records)
  if (records.length < 20) {
    console.warn(`⚠ Mało procesów-ustaw: ${records.length} — sprawdź diagnostykę (mapowanie etapów).`)
  }
  console.log('✔ Proces legislacyjny zsynchronizowany.')
}

/** Emisja pustego zestawu (gdy API nie zwróciło procesów). */
async function emitEmpty() {
  await fs.rm(DATA_DIR, { recursive: true, force: true })
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.rm(OUT_DIR, { recursive: true, force: true })
  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ generatedAt: readGeneratedAt(), placeholder: false, term: TERM, total: 0 })
  )
  await fs.writeFile(path.join(OUT_DIR, 'list.json'), JSON.stringify([]))
}

function readGeneratedAt(): string {
  // Reużyj znacznika z meta.json, jeśli jest — inaczej pusty (stabilne buildy).
  try {
    const meta = JSON.parse(readFileSync(path.join(ROOT, 'data', 'meta.json'), 'utf8')) as {
      generatedAt?: string
    }
    return meta.generatedAt ?? ''
  } catch {
    return ''
  }
}

async function writeDiagnostics(records: ProcessRecord[]) {
  const statusCount = new Map<ProcessStatus, number>()
  const initiatorCount = new Map<Initiator, number>()
  let withFinalVote = 0
  let resolvedFinalVote = 0
  let frozen = 0
  const nowISO = new Date().toISOString()
  for (const r of records) {
    statusCount.set(r.status, (statusCount.get(r.status) ?? 0) + 1)
    initiatorCount.set(r.initiator, (initiatorCount.get(r.initiator) ?? 0) + 1)
    if (isFrozen(r.status, lastStepDate(r), nowISO)) frozen++
    if (r.finalVote) {
      withFinalVote++
      const f = path.join(VOTINGS_DIR, `s${r.finalVote.sitting}`, `${r.finalVote.voting}.json`)
      if (existsSync(f)) resolvedFinalVote++
    }
  }
  const topStages = [...stageNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
  const examples = records
    .filter((r) => r.steps.length >= 4)
    .slice(0, 3)
    .map(
      (r) =>
        `${r.num} [${r.status}/${r.initiator}] ${r.title.slice(0, 55)} :: ` +
        r.steps.map((s) => s.stage + (s.vote ? `(g:${s.vote.sitting}/${s.vote.voting})` : '')).join(' → ')
    )

  const diag = [
    `Procesy-ustawy (zapisane): ${records.length}`,
    `Odrzucone przy normalizacji — bez tytułu/num: ${rejNoTitle}, nie-ustawa: ${rejNoUstaw}, bez rozpoznanych etapów: ${rejNoSteps}`,
    `Statusy: ${[...statusCount.entries()].map(([k, n]) => `${k}:${n}`).join(', ')}`,
    `Inicjatorzy: ${[...initiatorCount.entries()].map(([k, n]) => `${k}:${n}`).join(', ')}`,
    `W zamrażarce sejmowej (w toku, ≥90 dni bez ruchu): ${frozen}`,
    `finalVote: ${withFinalVote} (rozwiązane do istniejącego głosowania: ${resolvedFinalVote})`,
    `Nierozpoznane nazwy etapów: ${unknownStages.size}`,
    unknownStages.size
      ? '  ' + [...unknownStages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => `„${k}"×${n}`).join('\n  ')
      : '  (brak — wszystkie etapy rozpoznane)',
    `Wszystkie nazwy etapów (top 40):`,
    topStages.length ? '  ' + topStages.map(([k, n]) => `„${k}"×${n}`).join('\n  ') : '  (brak — API nie zwróciło etapów?)',
    `Surowy przykład stages[0..2]: ${rawSample ?? '(brak)'}`,
    `Przykładowe osie:`,
    examples.length ? '  ' + examples.join('\n  ') : '  (brak procesów z ≥4 etapami)',
  ].join('\n  ')

  console.log('  ' + diag)
  await fs.writeFile(DIAG_FILE, diag + '\n')
}

main().catch((err) => {
  console.error('✖ Błąd sync:legislation:', err.message)
  process.exit(1)
})
