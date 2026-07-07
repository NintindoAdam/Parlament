/**
 * Głosowania Sejmu — pobieranie, cache i emisja danych dla strony.
 *
 * Dla każdego posiedzenia pobiera listę głosowań i szczegóły z głosami
 * indywidualnymi. Surowe dane (tytuł, temat, rodzaj, zgrupowane głosy)
 * trafiają do cache per posiedzenie (data/votings-cache, schema 2) —
 * zakończone posiedzenia są niezmienne, więc kolejne uruchomienia pobierają
 * tylko 2 najnowsze. Z jednego źródła powstają dwa produkty:
 *
 *  1. data/attendance.json — frekwencja per poseł (profil posła),
 *  2. public/votings/**   — manifest + indeksy posiedzeń + szczegóły głosowań
 *     dla widoku „Jak głosowali?" na stronie głównej.
 *
 * Uruchomienie:  npm run sync:votings
 * Konfiguracja:  SEJM_TERM (domyślnie 10).
 *
 * Semantyka frekwencji: mianownik = głosowania, w których poseł figuruje na
 * liście votes[]. Oddany głos = YES / NO / ABSTAIN / VOTE_VALID; ABSENT =
 * nieobecność; nieznany kod → ABSENT.
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
const ATTENDANCE_FILE = path.join(ROOT, 'data', 'attendance.json')
const OUT_DIR = path.join(ROOT, 'public', 'votings')

const CACHE_SCHEMA = 2
const TITLE_MAX = 300
const TOPIC_MAX = 200

interface GroupedVotes {
  y: number[]
  n: number[]
  a: number[]
  x: number[]
  v: number[]
}

interface VotingRecord {
  num: number
  date: string
  title: string
  topic: string
  kind: string
  votes: GroupedVotes
}

interface SittingCache {
  schema: number
  sitting: number
  lastVotingDate: string
  votings: VotingRecord[]
}

interface VotingListItem {
  votingNumber?: number
  date?: string
  title?: string
  topic?: string
  description?: string
  kind?: string
}

interface VotingDetailApi {
  date?: string
  title?: string
  topic?: string
  description?: string
  kind?: string
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

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s)

async function fetchSitting(sitting: number): Promise<SittingCache> {
  const list = (await fetchJson<VotingListItem[]>(`${API}/votings/${sitting}`)) ?? []
  const votings: VotingRecord[] = []
  let lastVotingDate = ''

  await pool(list, 8, async (item) => {
    const num = item.votingNumber
    if (num == null) return
    const detail = await fetchJson<VotingDetailApi>(`${API}/votings/${sitting}/${num}`)
    if (!detail) return
    const groups: GroupedVotes = { y: [], n: [], a: [], x: [], v: [] }
    for (const v of detail.votes ?? []) {
      if (v.MP == null) continue
      switch (v.vote) {
        case 'YES':
          groups.y.push(v.MP)
          break
        case 'NO':
          groups.n.push(v.MP)
          break
        case 'ABSTAIN':
          groups.a.push(v.MP)
          break
        case 'VOTE_VALID':
          groups.v.push(v.MP)
          break
        default:
          groups.x.push(v.MP)
      }
    }
    const date = (detail.date ?? item.date ?? '').slice(0, 19)
    if (date.slice(0, 10) > lastVotingDate) lastVotingDate = date.slice(0, 10)
    votings.push({
      num,
      date,
      title: clip((detail.title ?? item.title ?? `Głosowanie nr ${num}`).trim(), TITLE_MAX),
      topic: clip((detail.topic ?? detail.description ?? item.topic ?? item.description ?? '').trim(), TOPIC_MAX),
      kind: detail.kind ?? item.kind ?? 'ELECTRONIC',
      votes: groups,
    })
  })

  votings.sort((a, b) => a.num - b.num)
  return { schema: CACHE_SCHEMA, sitting, lastVotingDate, votings }
}

function emptyStats(): AttendanceStats {
  return { total: 0, cast: 0, yes: 0, no: 0, abstain: 0, absent: 0 }
}

/** Frekwencja per poseł wyliczana z surowych, zgrupowanych głosów. */
function deriveAttendance(sittings: SittingCache[]): Record<string, AttendanceStats> {
  const perMP: Record<string, AttendanceStats> = {}
  const bump = (id: number, apply: (s: AttendanceStats) => void) => {
    const key = String(id)
    if (!perMP[key]) perMP[key] = emptyStats()
    const s = perMP[key]
    s.total++
    apply(s)
  }
  for (const sc of sittings) {
    for (const v of sc.votings) {
      for (const id of v.votes.y) bump(id, (s) => { s.cast++; s.yes++ })
      for (const id of v.votes.n) bump(id, (s) => { s.cast++; s.no++ })
      for (const id of v.votes.a) bump(id, (s) => { s.cast++; s.abstain++ })
      for (const id of v.votes.v) bump(id, (s) => { s.cast++ })
      for (const id of v.votes.x) bump(id, (s) => { s.absent++ })
    }
  }
  return perMP
}

async function emitPublic(sittings: SittingCache[], generatedAt: string): Promise<number> {
  await fs.rm(OUT_DIR, { recursive: true, force: true })
  await fs.mkdir(OUT_DIR, { recursive: true })

  let files = 0
  const manifest = {
    generatedAt,
    placeholder: false,
    term: TERM,
    sittings: [...sittings]
      .filter((sc) => sc.votings.length > 0)
      .sort((a, b) => b.sitting - a.sitting)
      .map((sc) => ({
        num: sc.sitting,
        firstDate: sc.votings[0]?.date.slice(0, 10) ?? '',
        lastDate: sc.lastVotingDate,
        votings: sc.votings.length,
      })),
  }
  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest))

  for (const sc of sittings) {
    if (sc.votings.length === 0) continue
    const dir = path.join(OUT_DIR, `s${sc.sitting}`)
    await fs.mkdir(dir, { recursive: true })
    const index = {
      sitting: sc.sitting,
      votings: sc.votings.map((v) => ({
        num: v.num,
        date: v.date,
        title: v.title,
        topic: v.topic,
        kind: v.kind,
        yes: v.votes.y.length,
        no: v.votes.n.length,
        abstain: v.votes.a.length,
        absent: v.votes.x.length,
      })),
    }
    await fs.writeFile(path.join(dir, 'index.json'), JSON.stringify(index))
    files++
    for (const v of sc.votings) {
      await fs.writeFile(
        path.join(dir, `${v.num}.json`),
        JSON.stringify({ sitting: sc.sitting, ...v })
      )
      files++
    }
  }
  return files
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true })

  console.log(`→ Pobieranie listy posiedzeń (kadencja ${TERM})…`)
  const proceedings = (await fetchJson<{ number?: number }[]>(`${API}/proceedings`)) ?? []
  const sittingNums = [
    ...new Set(proceedings.map((p) => p.number).filter((n): n is number => !!n && n > 0)),
  ].sort((a, b) => a - b)
  if (sittingNums.length === 0) throw new Error('brak posiedzeń w /proceedings')
  const freshSet = new Set(sittingNums.slice(-2)) // 2 najnowsze zawsze odświeżane
  console.log(`  Posiedzeń: ${sittingNums.length} (odświeżane: ${[...freshSet].join(', ')})`)

  const sittings: SittingCache[] = []
  for (const num of sittingNums) {
    const cachePath = path.join(CACHE_DIR, `sitting-${num}.json`)
    let sc: SittingCache | null = null
    if (!freshSet.has(num) && existsSync(cachePath)) {
      try {
        const cached = JSON.parse(readFileSync(cachePath, 'utf8')) as SittingCache
        if (cached.schema === CACHE_SCHEMA) sc = cached
      } catch {
        // uszkodzony plik cache — pobierz ponownie
      }
    }
    if (!sc) {
      sc = await fetchSitting(num)
      await fs.writeFile(cachePath, JSON.stringify(sc))
      console.log(`  Posiedzenie ${num}: ${sc.votings.length} głosowań (pobrano)`)
    } else {
      console.log(`  Posiedzenie ${num}: ${sc.votings.length} głosowań (cache)`)
    }
    sittings.push(sc)
  }

  const perMP = deriveAttendance(sittings)
  const totalVotings = sittings.reduce((a, sc) => a + sc.votings.length, 0)
  const lastVotingDate = sittings.reduce(
    (max, sc) => (sc.lastVotingDate > max ? sc.lastVotingDate : max),
    ''
  )

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
  // Spójność emisji: każdy rekord ma poprawne grupy (bez duplikatów posła).
  outer: for (const sc of sittings) {
    for (const v of sc.votings) {
      const all = [...v.votes.y, ...v.votes.n, ...v.votes.a, ...v.votes.x, ...v.votes.v]
      if (new Set(all).size !== all.length) {
        problems.push(`duplikat posła w głosowaniu ${sc.sitting}/${v.num}`)
        break outer
      }
    }
  }
  const mpsPath = path.join(ROOT, 'data', 'mps.json')
  const metaPath = path.join(ROOT, 'data', 'meta.json')
  if (existsSync(mpsPath) && existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { placeholder?: boolean }
    if (!meta.placeholder) {
      const mps = JSON.parse(readFileSync(mpsPath, 'utf8')) as {
        id: number
        active: boolean
        name: string
      }[]
      const active = mps.filter((m) => m.active)
      const covered = active.filter((m) => perMP[String(m.id)])
      if (covered.length < active.length * 0.95) {
        problems.push(`pokrycie aktywnych posłów: ${covered.length}/${active.length} (<95%)`)
      }
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

  const generatedAt = new Date().toISOString()

  const attendance: AttendanceFile = {
    generatedAt,
    placeholder: false,
    totalVotings,
    lastVotingDate,
    perMP,
  }
  await fs.writeFile(ATTENDANCE_FILE, JSON.stringify(attendance))

  const files = await emitPublic(sittings, generatedAt)

  console.log('✔ Głosowania zsynchronizowane.')
  console.log(
    `  Posiedzenia: ${sittingNums.length}, głosowania: ${totalVotings}, posłowie: ${Object.keys(perMP).length}, ` +
      `ostatnie głosowanie: ${lastVotingDate}, plików public/votings: ${files}`
  )
}

main().catch((err) => {
  console.error('✖ Błąd sync:votings:', err.message)
  process.exit(1)
})
