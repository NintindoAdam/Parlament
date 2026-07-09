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

const CACHE_SCHEMA = 1
const TITLE_MAX = 400

interface RawStage {
  stageName?: string
  name?: string
  date?: string
  decision?: string
  comment?: string
  sitting?: number
  votingNumber?: number
  voting?: { sitting?: number; votingNumber?: number; number?: number }
  votings?: { sitting?: number; votingNumber?: number; number?: number }[]
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

/** Wyciąga referencję do głosowania z etapu (kilka możliwych kształtów API). */
function extractVote(stage: RawStage): VoteRef | undefined {
  const cand = [
    stage.voting,
    ...(stage.votings ?? []),
    { sitting: stage.sitting, votingNumber: stage.votingNumber },
  ]
  for (const c of cand) {
    if (!c) continue
    const sitting = c.sitting
    const voting = (c as { votingNumber?: number }).votingNumber ?? (c as { number?: number }).number
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

function deriveStatus(steps: CanonicalStep[]): ProcessStatus {
  const has = (s: CanonicalStage) => steps.some((x) => x.stage === s)
  const decisions = steps.map((s) => (s.decision ?? '').toLowerCase()).join(' | ')
  if (has('publikacja')) return 'uchwalona'
  if (/odrzuc/.test(decisions) && !has('senat') && !has('prezydent')) return 'odrzucona'
  if (has('prezydent')) return 'zakonczona'
  return 'w_toku'
}

function normalize(detail: RawProcessDetail): ProcessRecord | null {
  const num = detail.number != null ? String(detail.number) : ''
  const title = clip((detail.title ?? '').trim(), TITLE_MAX)
  if (!num || !title) return null
  if (!/ustaw/i.test(title)) return null // skupiamy się na projektach ustaw

  const raw: CanonicalStep[] = []
  collectSteps(detail.stages ?? [], raw)
  const steps = mergeSteps(raw)
  if (steps.length === 0) return null

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
    status: deriveStatus(steps),
    steps,
    finalVote: glosowanie?.vote,
    printNums: [...new Set([num, ...prints])],
  }
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
  await fs.mkdir(DATA_DIR, { recursive: true })

  console.log(`→ Pobieranie listy procesów legislacyjnych (kadencja ${TERM})…`)
  const list = (await fetchJson<RawProcessListItem[]>(`${API}/processes`)) ?? []
  if (list.length === 0) throw new Error('brak procesów w /processes')
  console.log(`  Procesów na liście: ${list.length}`)

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
  const summaries: ProcessSummary[] = records.map((r) => ({
    num: r.num,
    title: r.title,
    initiator: r.initiator,
    status: r.status,
    startDate: r.startDate,
    lastStage: r.steps[r.steps.length - 1]?.stage ?? 'inicjatywa',
  }))
  const generatedAt = readGeneratedAt()
  await fs.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ generatedAt, placeholder: false, term: TERM, total: records.length })
  )
  await fs.writeFile(path.join(OUT_DIR, 'list.json'), JSON.stringify(summaries))

  // --- Walidacja twarda ------------------------------------------------------
  const problems: string[] = []
  if (records.length < 20) problems.push(`podejrzanie mało procesów-ustaw: ${records.length}`)
  if (records.every((r) => r.steps.length <= 1))
    problems.push('procesy nie mają etapów — sprawdź kształt pola stages[] w API')
  if (problems.length > 0) {
    console.error('✖ WALIDACJA NIE PRZESZŁA:')
    for (const p of problems) console.error('  - ' + p)
    process.exit(1)
  }

  await writeDiagnostics(records)
  console.log('✔ Proces legislacyjny zsynchronizowany.')
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
  for (const r of records) {
    statusCount.set(r.status, (statusCount.get(r.status) ?? 0) + 1)
    initiatorCount.set(r.initiator, (initiatorCount.get(r.initiator) ?? 0) + 1)
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
    `Procesy-ustawy: ${records.length}`,
    `Statusy: ${[...statusCount.entries()].map(([k, n]) => `${k}:${n}`).join(', ')}`,
    `Inicjatorzy: ${[...initiatorCount.entries()].map(([k, n]) => `${k}:${n}`).join(', ')}`,
    `finalVote: ${withFinalVote} (rozwiązane do istniejącego głosowania: ${resolvedFinalVote})`,
    `Nierozpoznane nazwy etapów: ${unknownStages.size}`,
    unknownStages.size
      ? '  ' + [...unknownStages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => `„${k}"×${n}`).join('\n  ')
      : '  (brak — wszystkie etapy rozpoznane)',
    `Wszystkie nazwy etapów (top 40):`,
    '  ' + topStages.map(([k, n]) => `„${k}"×${n}`).join('\n  '),
    `Przykładowe osie:`,
    '  ' + examples.join('\n  '),
  ].join('\n  ')

  console.log('  ' + diag)
  await fs.writeFile(DIAG_FILE, diag + '\n')
}

main().catch((err) => {
  console.error('✖ Błąd sync:legislation:', err.message)
  process.exit(1)
})
