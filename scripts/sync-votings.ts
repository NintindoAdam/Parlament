/**
 * Frekwencja posłów w głosowaniach — agregacja z oficjalnego API Sejmu.
 *
 * Dla każdego posiedzenia pobiera listę głosowań i ich szczegóły z głosami
 * indywidualnymi, zlicza per poseł (za / przeciw / wstrzymał się / nieobecny)
 * i zapisuje mały zagregowany plik data/attendance.json. Agregaty per
 * posiedzenie są cache'owane (data/votings-cache) — zakończone posiedzenia są
 * niezmienne, więc kolejne uruchomienia pobierają tylko 2 najnowsze.
 *
 * Uruchomienie:  npm run sync:votings
 * Konfiguracja:  SEJM_TERM (domyślnie 10).
 *
 * Semantyka: mianownik frekwencji posła = głosowania, w których figuruje na
 * liście votes[] (dowolny status). Oddany głos = YES / NO / ABSTAIN /
 * VOTE_VALID (głosowania listowe); nieobecność = ABSENT.
 */
import { promises as fs } from 'fs'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { AttendanceFile, AttendanceStats } from '../lib/types'

const TERM = Number(process.env.SEJM_TERM ?? '10')
const API = `https://api.sejm.gov.pl/sejm/term${TERM}`
const UA = 'Parlament-app/1.0 (https://github.com/NintindoAdam/Parlament; educational)'

const ROOT = process.cwd()
const CACHE_DIR = path.join(ROOT, 'data', 'votings-cache')
const OUT_FILE = path.join(ROOT, 'data', 'attendance.json')

const CACHE_SCHEMA = 1

interface SittingAggregate {
  schema: number
  sitting: number
  votings: number
  lastVotingDate: string
  perMP: Record<string, AttendanceStats>
}

interface VotingListItem {
  votingNumber?: number
  date?: string
}

interface VotingDetail {
  date?: string
  votes?: { MP?: number; vote?: string }[]
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

function emptyStats(): AttendanceStats {
  return { total: 0, cast: 0, yes: 0, no: 0, abstain: 0, absent: 0 }
}

function addVote(stats: AttendanceStats, vote: string): void {
  stats.total++
  switch (vote) {
    case 'YES':
      stats.cast++
      stats.yes++
      break
    case 'NO':
      stats.cast++
      stats.no++
      break
    case 'ABSTAIN':
      stats.cast++
      stats.abstain++
      break
    case 'VOTE_VALID':
      // Głosowanie listowe — głos oddany, bez rozstrzygnięcia za/przeciw.
      stats.cast++
      break
    case 'ABSENT':
    default:
      stats.absent++
      break
  }
}

async function aggregateSitting(sitting: number): Promise<SittingAggregate> {
  const list = (await fetchJson<VotingListItem[]>(`${API}/votings/${sitting}`)) ?? []
  const perMP: Record<string, AttendanceStats> = {}
  let lastVotingDate = ''
  let done = 0

  await pool(list, 8, async (item) => {
    const num = item.votingNumber
    if (num == null) return
    const detail = await fetchJson<VotingDetail>(`${API}/votings/${sitting}/${num}`)
    const votes = detail?.votes ?? []
    const date = (detail?.date ?? item.date ?? '').slice(0, 10)
    if (date > lastVotingDate) lastVotingDate = date
    for (const v of votes) {
      if (v.MP == null) continue
      const key = String(v.MP)
      if (!perMP[key]) perMP[key] = emptyStats()
      addVote(perMP[key], v.vote ?? 'ABSENT')
    }
    done++
  })

  return { schema: CACHE_SCHEMA, sitting, votings: done, lastVotingDate, perMP }
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true })

  console.log(`→ Pobieranie listy posiedzeń (kadencja ${TERM})…`)
  const proceedings =
    (await fetchJson<{ number?: number }[]>(`${API}/proceedings`)) ?? []
  const sittings = [...new Set(proceedings.map((p) => p.number).filter((n): n is number => !!n && n > 0))].sort(
    (a, b) => a - b
  )
  if (sittings.length === 0) throw new Error('brak posiedzeń w /proceedings')
  const freshSet = new Set(sittings.slice(-2)) // 2 najnowsze zawsze odświeżane
  console.log(`  Posiedzeń: ${sittings.length} (odświeżane: ${[...freshSet].join(', ')})`)

  const aggregates: SittingAggregate[] = []
  for (const sitting of sittings) {
    const cachePath = path.join(CACHE_DIR, `sitting-${sitting}.json`)
    let agg: SittingAggregate | null = null
    if (!freshSet.has(sitting) && existsSync(cachePath)) {
      try {
        const cached = JSON.parse(readFileSync(cachePath, 'utf8')) as SittingAggregate
        if (cached.schema === CACHE_SCHEMA) agg = cached
      } catch {
        // uszkodzony plik cache — pobierz ponownie
      }
    }
    if (!agg) {
      agg = await aggregateSitting(sitting)
      await fs.writeFile(cachePath, JSON.stringify(agg))
      console.log(`  Posiedzenie ${sitting}: ${agg.votings} głosowań (pobrano)`)
    } else {
      console.log(`  Posiedzenie ${sitting}: ${agg.votings} głosowań (cache)`)
    }
    aggregates.push(agg)
  }

  // Suma agregatów.
  const perMP: Record<string, AttendanceStats> = {}
  let totalVotings = 0
  let lastVotingDate = ''
  for (const agg of aggregates) {
    totalVotings += agg.votings
    if (agg.lastVotingDate > lastVotingDate) lastVotingDate = agg.lastVotingDate
    for (const [id, s] of Object.entries(agg.perMP)) {
      if (!perMP[id]) perMP[id] = emptyStats()
      const t = perMP[id]
      t.total += s.total
      t.cast += s.cast
      t.yes += s.yes
      t.no += s.no
      t.abstain += s.abstain
      t.absent += s.absent
    }
  }

  // --- Walidacja (twarda) ----------------------------------------------------
  const problems: string[] = []
  if (totalVotings < 500) problems.push(`podejrzanie mało głosowań: ${totalVotings}`)
  const absentSum = Object.values(perMP).reduce((a, s) => a + s.absent, 0)
  if (absentSum === 0) {
    problems.push('suma nieobecności = 0 — API prawdopodobnie nie zwraca wpisów ABSENT')
  }
  for (const [id, s] of Object.entries(perMP)) {
    if (s.cast + s.absent !== s.total) {
      problems.push(`niespójne liczniki dla posła ${id}: cast+absent != total`)
      break
    }
  }
  const mpsPath = path.join(ROOT, 'data', 'mps.json')
  const metaPath = path.join(ROOT, 'data', 'meta.json')
  if (existsSync(mpsPath) && existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { placeholder?: boolean }
    if (!meta.placeholder) {
      const mps = JSON.parse(readFileSync(mpsPath, 'utf8')) as { id: number; active: boolean; name: string }[]
      const active = mps.filter((m) => m.active)
      const covered = active.filter((m) => perMP[String(m.id)])
      if (covered.length < active.length * 0.95) {
        problems.push(`pokrycie aktywnych posłów: ${covered.length}/${active.length} (<95%)`)
      }
      // Podsumowanie: skrajne frekwencje (pomocne przy weryfikacji ze statystykami Sejmu).
      const ranked = active
        .filter((m) => perMP[String(m.id)]?.total)
        .map((m) => ({ name: m.name, s: perMP[String(m.id)] }))
        .sort((a, b) => b.s.cast / b.s.total - a.s.cast / a.s.total)
      const fmt = (x: { name: string; s: AttendanceStats }) =>
        `${x.name} ${((x.s.cast / x.s.total) * 100).toFixed(1)}% (${x.s.cast}/${x.s.total})`
      console.log('  Najwyższa frekwencja: ' + ranked.slice(0, 3).map(fmt).join('; '))
      console.log('  Najniższa frekwencja: ' + ranked.slice(-3).map(fmt).join('; '))
    }
  }

  if (problems.length > 0) {
    console.error('✖ WALIDACJA NIE PRZESZŁA:')
    for (const p of problems) console.error('  - ' + p)
    process.exit(1)
  }

  const out: AttendanceFile = {
    generatedAt: new Date().toISOString(),
    placeholder: false,
    totalVotings,
    lastVotingDate,
    perMP,
  }
  await fs.writeFile(OUT_FILE, JSON.stringify(out))

  console.log('✔ Frekwencja zagregowana.')
  console.log(
    `  Posiedzenia: ${sittings.length}, głosowania: ${totalVotings}, posłowie: ${Object.keys(perMP).length}, ostatnie głosowanie: ${lastVotingDate}`
  )
}

main().catch((err) => {
  console.error('✖ Błąd sync:votings:', err.message)
  process.exit(1)
})
