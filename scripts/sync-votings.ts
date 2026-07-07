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

const CACHE_SCHEMA = 4
const TITLE_MAX = 300
const TOPIC_MAX = 200
const OPTION_MAX = 120

interface GroupedVotes {
  y: number[]
  n: number[]
  a: number[]
  x: number[]
  v: number[]
  /** Głosowania listowe: numer opcji (1-based, jako string) → posłowie, którzy ją wybrali. */
  l?: Record<string, number[]>
}

interface VotingRecord {
  num: number
  date: string
  title: string
  topic: string
  kind: string
  majorityType?: string
  majorityVotes?: number
  notParticipating?: number
  totalVoted?: number
  /** Opisy opcji głosowania listowego (indeks 0 = opcja „1"). */
  options?: string[]
  votes: GroupedVotes
}

interface SittingCache {
  schema: number
  sitting: number
  lastVotingDate: string
  votings: VotingRecord[]
}

interface MajorityFields {
  majorityType?: string
  majorityVotes?: number
  notParticipating?: number
  totalVoted?: number
}

interface VotingListItem extends MajorityFields {
  votingNumber?: number
  date?: string
  title?: string
  topic?: string
  description?: string
  kind?: string
}

interface VotingDetailApi extends MajorityFields {
  date?: string
  title?: string
  topic?: string
  description?: string
  kind?: string
  /** Opcje głosowania listowego — API zwraca votingOptions[{option?, optionIndex?, description?}]. */
  votingOptions?: { option?: string; optionIndex?: number; description?: string }[]
  votes?: {
    MP?: number
    vote?: string
    /** Wybrane opcje w głosowaniu listowym: tablica numerów LUB mapa nr→YES/NO. */
    listVotes?: unknown
  }[]
}

/**
 * Normalizuje pole listVotes do listy numerów wybranych opcji.
 * Obsługuje oba spotykane kształty: tablicę numerów oraz mapę {"1":"YES",…}.
 */
function selectedOptions(listVotes: unknown): string[] {
  if (Array.isArray(listVotes)) return listVotes.map((v) => String(v))
  if (listVotes && typeof listVotes === 'object') {
    return Object.entries(listVotes as Record<string, unknown>)
      .filter(([, v]) => v === 'YES' || v === true || v === 'true')
      .map(([k]) => k)
  }
  return []
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
    const byOption: Record<string, number[]> = {}
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
        case 'VOTE_VALID': {
          groups.v.push(v.MP)
          for (const opt of selectedOptions(v.listVotes)) {
            if (!byOption[opt]) byOption[opt] = []
            byOption[opt].push(v.MP)
          }
          break
        }
        default:
          groups.x.push(v.MP)
      }
    }
    if (Object.keys(byOption).length > 0) groups.l = byOption

    // Opisy opcji głosowania listowego, w kolejności numerów opcji.
    const options = (detail.votingOptions ?? [])
      .map((o, i) => ({
        idx: o.optionIndex ?? i + 1,
        label: clip((o.option ?? o.description ?? `Opcja ${i + 1}`).trim(), OPTION_MAX),
      }))
      .sort((a, b) => a.idx - b.idx)
      .map((o) => o.label)
    const date = (detail.date ?? item.date ?? '').slice(0, 19)
    if (date.slice(0, 10) > lastVotingDate) lastVotingDate = date.slice(0, 10)
    const record: VotingRecord = {
      num,
      date,
      title: clip((detail.title ?? item.title ?? `Głosowanie nr ${num}`).trim(), TITLE_MAX),
      topic: clip((detail.topic ?? detail.description ?? item.topic ?? item.description ?? '').trim(), TOPIC_MAX),
      kind: detail.kind ?? item.kind ?? 'ELECTRONIC',
      votes: groups,
    }
    const majorityType = detail.majorityType ?? item.majorityType
    const majorityVotes = detail.majorityVotes ?? item.majorityVotes
    const notParticipating = detail.notParticipating ?? item.notParticipating
    const totalVoted = detail.totalVoted ?? item.totalVoted
    if (majorityType) record.majorityType = majorityType
    if (typeof majorityVotes === 'number') record.majorityVotes = majorityVotes
    if (typeof notParticipating === 'number') record.notParticipating = notParticipating
    if (typeof totalVoted === 'number') record.totalVoted = totalVoted
    if (options.length > 0) record.options = options
    votings.push(record)
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
        ...(v.majorityType ? { majorityType: v.majorityType } : {}),
        ...(v.majorityVotes != null ? { majorityVotes: v.majorityVotes } : {}),
        ...(v.notParticipating != null ? { notParticipating: v.notParticipating } : {}),
        ...(v.totalVoted != null ? { totalVoted: v.totalVoted } : {}),
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

  // Diagnostyka głosowań listowych: ile ma opcje i rozbicie per opcja.
  let onList = 0
  let withOptions = 0
  let sample: string | null = null
  for (const sc of sittings) {
    for (const v of sc.votings) {
      if (v.kind !== 'ON_LIST' && !v.votes.l) continue
      onList++
      if (v.options?.length && v.votes.l) {
        withOptions++
        if (!sample) {
          sample = `${sc.sitting}/${v.num} „${v.title.slice(0, 60)}" opcje=[${v.options
            .map((o, i) => `${i + 1}:${o.slice(0, 30)} (${v.votes.l?.[String(i + 1)]?.length ?? 0})`)
            .join('; ')}]`
        }
      }
    }
  }
  console.log('✔ Głosowania zsynchronizowane.')
  console.log(
    `  Posiedzenia: ${sittingNums.length}, głosowania: ${totalVotings}, posłowie: ${Object.keys(perMP).length}, ` +
      `ostatnie głosowanie: ${lastVotingDate}, plików public/votings: ${files}`
  )
  console.log(`  Głosowania listowe: ${onList}, z rozbiciem na opcje: ${withOptions}`)
  if (sample) console.log(`  Przykład: ${sample}`)
  if (onList > 0 && withOptions === 0) {
    console.warn('  ⚠ Żadne głosowanie listowe nie ma rozbicia na opcje — sprawdź kształt pola listVotes/votingOptions w API.')
  }

  // Diagnostyka rodzajów większości + weryfikacja semantyki majorityVotes.
  const typeStats = new Map<string, number>()
  let withThreshold = 0
  let typedNoThreshold = 0
  for (const sc of sittings) {
    for (const v of sc.votings) {
      const t = v.majorityType ?? '(brak)'
      typeStats.set(t, (typeStats.get(t) ?? 0) + 1)
      if (typeof v.majorityVotes === 'number' && v.majorityVotes > 0) withThreshold++
      else if (v.majorityType) typedNoThreshold++
    }
  }
  const outcome = (v: VotingRecord): string => {
    if (v.kind === 'ON_LIST') return '—'
    if (typeof v.majorityVotes === 'number' && v.majorityVotes > 0)
      return v.votes.y.length >= v.majorityVotes ? 'PRZYJĘTO' : 'ODRZUCONO'
    if (v.majorityType === 'SIMPLE_MAJORITY') return v.votes.y.length > v.votes.n.length ? 'PRZYJĘTO' : 'ODRZUCONO'
    if (v.majorityType === 'ABSOLUTE_MAJORITY')
      return v.votes.y.length > v.votes.n.length + v.votes.a.length ? 'PRZYJĘTO' : 'ODRZUCONO'
    return '?'
  }
  const fmtRow = (sitting: number, v: VotingRecord) =>
    `s${sitting}/${v.num} ${v.majorityType ?? '(brak)'} próg=${v.majorityVotes ?? '?'} za=${v.votes.y.length} przeciw=${v.votes.n.length} wstrz=${v.votes.a.length} oddano=${v.totalVoted ?? '?'} -> ${outcome(v)} | ${v.title.slice(0, 50)}`

  // Przykłady głosowań o większości innej niż zwykła — do weryfikacji progów.
  const nonSimple: string[] = []
  for (const sc of sittings) {
    for (const v of sc.votings) {
      if (v.majorityType && v.majorityType !== 'SIMPLE_MAJORITY' && nonSimple.length < 12) {
        nonSimple.push(fmtRow(sc.sitting, v))
      }
    }
  }

  // Punkt kontrolny (plan): głosowanie o pociągnięcie posła Mentzena do
  // odpowiedzialności — posiedzenie 59, głosowanie 51 (większość bezwzględna,
  // próg 231; za 227 → wniosek NIE przeszedł). Wyszukaj i wypisz, jeśli obecne.
  const check: string[] = []
  const s59 = sittings.find((s) => s.sitting === 59)
  if (s59) {
    for (const v of s59.votings) {
      if (v.majorityType && v.majorityType !== 'SIMPLE_MAJORITY') check.push(fmtRow(59, v))
    }
  }

  // Spójność manifest ↔ pliki indeksów: każde posiedzenie z manifestu MUSI mieć
  // zapisany s{n}/index.json, inaczej UI pokaże „Nie udało się pobrać danych".
  const manifestSittings = [...sittings]
    .filter((sc) => sc.votings.length > 0)
    .sort((a, b) => b.sitting - a.sitting)
  const missingIndex: number[] = []
  for (const sc of manifestSittings) {
    try {
      await fs.access(path.join(OUT_DIR, `s${sc.sitting}`, 'index.json'))
    } catch {
      missingIndex.push(sc.sitting)
    }
  }
  const sittingList = manifestSittings
    .map((sc) => `${sc.sitting}:${sc.votings.length}`)
    .join(', ')

  const diag = [
    `Posiedzenia w manifeście (nr:głosowań): ${sittingList}`,
    missingIndex.length
      ? `⚠ BRAK index.json dla posiedzeń: ${missingIndex.join(', ')}`
      : 'Spójność manifest↔indeksy: OK (każde posiedzenie ma index.json)',
    `Rodzaje większości: ${[...typeStats.entries()].map(([k, n]) => `${k}:${n}`).join(', ')}`,
    `Z progiem majorityVotes: ${withThreshold}, z typem bez progu: ${typedNoThreshold}`,
    nonSimple.length ? 'Przykłady (nie-zwykła większość):\n    ' + nonSimple.join('\n    ') : 'Brak głosowań innych niż zwykła większość.',
    s59
      ? check.length
        ? 'Punkt kontrolny — posiedzenie 59 (nie-zwykła większość):\n    ' + check.join('\n    ')
        : 'Punkt kontrolny — posiedzenie 59 obecne, ale bez głosowań o większości innej niż zwykła.'
      : 'Punkt kontrolny — posiedzenie 59 niedostępne w tym przebiegu.',
  ].join('\n  ')

  console.log('  ' + diag)
  // Zapis do pliku, by krok workflow mógł wypisać diagnostykę na KOŃCU logu
  // (dostępnego przez API), za listą plików artefaktu.
  await fs.writeFile(path.join(ROOT, 'data', 'votings-diag.txt'), diag + '\n')
}

main().catch((err) => {
  console.error('✖ Błąd sync:votings:', err.message)
  process.exit(1)
})
