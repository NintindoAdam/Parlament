/**
 * Budowa indeksu miejscowości dla zakładki „Kto mnie reprezentuje?".
 *
 * Pobiera oficjalny rejestr „Wykaz urzędowych nazw miejscowości i ich części"
 * (dane.gov.pl), łączy każdą miejscowość z okręgiem wyborczym przez tabelę
 * powiat→okręg (data/okregi.json), twardo waliduje pokrycie i emituje
 * chunkowany indeks do public/places/ (+ manifest).
 *
 * Uruchomienie:  npm run sync:places
 * Konfiguracja:  PLACES_CSV_URL — bezpośredni URL do CSV (pomija discovery).
 *
 * Projektowane do CI (runner ma otwarty internet). Awaria pobierania używa
 * cache (data/places-cache), a brak i cache, i pobrania = twardy błąd — lepiej
 * zatrzymać deploy niż opublikować zakładkę bez indeksu.
 */
import { promises as fs } from 'fs'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { chunkKey, normalizePlace, type PlaceTuple } from '../lib/places'

const ROOT = process.cwd()
const CACHE_DIR = path.join(ROOT, 'data', 'places-cache')
const CACHE_CSV = path.join(CACHE_DIR, 'source.csv')
const OUT_DIR = path.join(ROOT, 'public', 'places')
const OKREGI = JSON.parse(readFileSync(path.join(ROOT, 'data', 'okregi.json'), 'utf8')) as {
  districts: { num: number; name: string; voivodeship: string }[]
  powiaty: { woj: string; powiat: string; okreg: number }[]
}
const UA = 'Parlament-app/1.0 (https://github.com/NintindoAdam/Parlament; educational)'

/** Aliasowanie nazw powiatów w rejestrze → klucz w okregi.json (zmiany nazw itp.). */
const POWIAT_ALIASES: Record<string, string> = {
  jeleniogorski: 'karkonoski',
}

// --- Typy rodzajów miejscowości -------------------------------------------

function mapRodzaj(raw: string): string {
  const r = normalizePlace(raw)
  if (r.includes('czesc')) return 'cz'
  if (r.startsWith('przysiolek')) return 'p'
  if (r.startsWith('kolonia')) return 'kl'
  if (r.startsWith('osada lesna')) return 'ol'
  if (r.startsWith('osada')) return 'os'
  if (r === 'wies') return 'w'
  if (r === 'miasto') return 'm'
  return '?'
}

// --- Pobieranie -------------------------------------------------------------

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: ctrl.signal,
      redirect: 'follow',
    })
  } finally {
    clearTimeout(timer)
  }
}

interface ApiItem {
  id: string
  type?: string
  attributes?: {
    title?: string
    model?: string
    format?: string
    file_url?: string
    link?: string
    download_url?: string
    /** Automatycznie skonwertowany CSV (gdy oryginał to np. XLSX). */
    csv_file_url?: string
    csv_download_url?: string
    created?: string
    data_date?: string
    verified?: string
  }
}

/** Model elementu API: /search zwraca type='common', a właściwy typ w attributes.model. */
function kindOf(d: ApiItem): string {
  return d.attributes?.model ?? d.type ?? '?'
}

async function apiJson(url: string): Promise<{ data?: ApiItem[] }> {
  const res = await fetchWithTimeout(url, 30000)
  if (!res.ok) throw new Error(`HTTP ${res.status} dla ${url}`)
  return (await res.json()) as { data?: ApiItem[] }
}

/** API /search zwraca tytuły z tagami podświetlenia (<mark>…</mark>) — zdejmujemy je. */
function stripTags(s: string | undefined): string {
  return (s ?? '').replace(/<[^>]+>/g, '')
}

function titleMatches(title: string | undefined): boolean {
  const n = normalizePlace(stripTags(title))
  return n.includes('urzedowych nazw miejscowosci')
}

function logTitles(label: string, items: ApiItem[]): void {
  const entries = items.slice(0, 6).map((d) => {
    const title = stripTags(d.attributes?.title) || '?'
    return `„${title.slice(0, 70)}" [${kindOf(d)}]`
  })
  console.log(`  [${label}] ${items.length} wyników: ${entries.join('; ')}`)
}

/** Diagnostyka zasobów: format + dostępne pola URL — widoczna w logach CI. */
function logResourceDetails(items: ApiItem[]): void {
  for (const r of items.slice(0, 8)) {
    const a = r.attributes ?? {}
    const urls = (['file_url', 'csv_file_url', 'download_url', 'link'] as const)
      .filter((k) => a[k])
      .join(',')
    console.log(
      `    · „${stripTags(a.title).slice(0, 60)}" format=${a.format ?? '?'} urls=[${urls || 'brak'}]`
    )
  }
}

/**
 * Wybiera najlepszy URL pliku CSV z listy zasobów. Priorytet: oryginalny CSV →
 * automatycznie skonwertowany CSV (csv_file_url, gdy oryginał to XLSX itp.).
 */
function pickCsv(items: ApiItem[]): { url: string; title: string; date: string } | null {
  const candidates = items
    .map((r) => {
      const a = r.attributes ?? {}
      const format = (a.format ?? '').toLowerCase()
      const original = a.file_url || a.download_url || a.link || ''
      let url = ''
      let direct = 0
      if (format === 'csv' || original.toLowerCase().includes('.csv')) {
        url = original
        direct = original.toLowerCase().includes('.csv') || original.includes('/media/') ? 2 : 1
      } else if (a.csv_file_url || a.csv_download_url) {
        url = a.csv_file_url || a.csv_download_url || ''
        direct = 1
      }
      return {
        url,
        title: a.title ?? '',
        date: a.data_date || a.verified || a.created || '',
        direct,
      }
    })
    .filter((r) => r.url)
    .sort((a, b) => b.direct - a.direct || b.date.localeCompare(a.date))
  return candidates[0] ?? null
}

/**
 * Znajduje najnowszy zasób CSV wykazu miejscowości przez API dane.gov.pl,
 * próbując kolejno kilku endpointów (loguje, co zwróciło każde podejście —
 * przy zmianach API log CI od razu pokazuje przyczynę).
 */
async function discoverCsvUrl(): Promise<string> {
  const API = 'https://api.dane.gov.pl/1.4'
  const q = encodeURIComponent('wykaz urzędowych nazw miejscowości')
  const errors: string[] = []

  // Strategia 1: pełnotekstowe /search po zasobach (CSV bezpośrednio).
  try {
    const body = await apiJson(`${API}/search?q=${q}&per_page=40`)
    const items = body.data ?? []
    logTitles('search', items)
    const matching = items.filter((d) => titleMatches(d.attributes?.title))
    // Najpierw zbiór danych — jego zasoby mają wiarygodne file_url.
    const dataset = matching.find((d) => kindOf(d) === 'dataset')
    if (dataset) return await csvFromDataset(API, dataset)
    const resources = matching.filter((d) => kindOf(d) === 'resource')
    const csv = pickCsv(resources)
    if (csv) {
      console.log(`  Zasób CSV (search): „${stripTags(csv.title)}" (${csv.date})`)
      return csv.url
    }
    errors.push('search: brak pasującego zasobu/zbioru')
  } catch (e) {
    errors.push(`search: ${(e as Error).message}`)
  }

  // Strategia 2: lista zbiorów z parametrem q.
  try {
    const body = await apiJson(`${API}/datasets?q=${q}&per_page=40`)
    const items = body.data ?? []
    logTitles('datasets', items)
    const dataset = items.find((d) => titleMatches(d.attributes?.title))
    if (dataset) return await csvFromDataset(API, dataset)
    errors.push('datasets: brak pasującego zbioru')
  } catch (e) {
    errors.push(`datasets: ${(e as Error).message}`)
  }

  throw new Error(
    `nie znaleziono zbioru „Wykaz urzędowych nazw miejscowości" (${errors.join(' | ')}). ` +
      'Można wskazać plik ręcznie przez env PLACES_CSV_URL.'
  )
}

async function csvFromDataset(API: string, dataset: ApiItem): Promise<string> {
  console.log(`  Zbiór danych: ${stripTags(dataset.attributes?.title)} (id ${dataset.id})`)
  const rBody = await apiJson(`${API}/datasets/${dataset.id}/resources?per_page=100`)
  const items = rBody.data ?? []
  logTitles('resources', items)
  logResourceDetails(items)
  const csv = pickCsv(items)
  if (!csv) throw new Error('brak zasobów CSV w zbiorze (formaty i URL-e zasobów w logu powyżej)')
  console.log(`  Zasób CSV: „${stripTags(csv.title)}" (${csv.date})`)
  return csv.url
}

async function obtainCsv(): Promise<string> {
  await fs.mkdir(CACHE_DIR, { recursive: true })
  try {
    const url = process.env.PLACES_CSV_URL || (await discoverCsvUrl())
    console.log(`→ Pobieranie rejestru miejscowości:\n  ${url}`)
    const res = await fetchWithTimeout(url, 120000)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1_000_000) throw new Error(`plik podejrzanie mały (${buf.length} B)`)
    const tmp = CACHE_CSV + '.tmp'
    await fs.writeFile(tmp, buf)
    await fs.rename(tmp, CACHE_CSV)
    console.log(`  Pobrano ${(buf.length / 1e6).toFixed(1)} MB.`)
  } catch (err) {
    if (existsSync(CACHE_CSV)) {
      console.warn(`⚠ Pobieranie nie powiodło się (${(err as Error).message}) — używam CSV z cache.`)
    } else {
      throw new Error(`Nie udało się pobrać rejestru i brak cache: ${(err as Error).message}`)
    }
  }
  return CACHE_CSV
}

// --- Parsowanie CSV ---------------------------------------------------------

function decodeCsv(buf: Buffer): string {
  const utf8 = buf.toString('utf8')
  // Heurystyka: poprawny UTF-8 nie zawiera znaku zastępczego; CP1250 — zawiera.
  if (!utf8.includes('\uFFFD')) return utf8.replace(/^\uFEFF/, '')
  console.log('  Wykryto kodowanie inne niż UTF-8 — dekoduję jako windows-1250.')
  return decodeCp1250(buf)
}

function decodeCp1250(buf: Buffer): string {
  const HIGH: Record<number, string> = {
    0x8c: 'Ś', 0x8f: 'Ź', 0x9c: 'ś', 0x9f: 'ź', 0xa3: 'Ł', 0xa5: 'Ą', 0xaf: 'Ż',
    0xb3: 'ł', 0xb9: 'ą', 0xbf: 'ż', 0xc6: 'Ć', 0xca: 'Ę', 0xd1: 'Ń', 0xd3: 'Ó',
    0xe6: 'ć', 0xea: 'ę', 0xf1: 'ń', 0xf3: 'ó',
  }
  let out = ''
  for (const b of buf) out += b < 0x80 ? String.fromCharCode(b) : HIGH[b] ?? '?'
  return out
}

/** Minimalny parser CSV ze wsparciem cudzysłowów. */
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.length > 1 || row[0] !== '') rows.push(row)
  }
  return rows
}

function findColumn(header: string[], ...patterns: ((h: string) => boolean)[]): number {
  for (const pattern of patterns) {
    const idx = header.findIndex((h) => pattern(normalizePlace(h)))
    if (idx !== -1) return idx
  }
  return -1
}

// --- Główny przebieg ---------------------------------------------------------

async function main() {
  const csvPath = await obtainCsv()
  const raw = decodeCsv(await fs.readFile(csvPath))
  const delimiter = raw.slice(0, raw.indexOf('\n')).includes(';') ? ';' : ','
  const rows = parseCsv(raw, delimiter)
  if (rows.length < 2) throw new Error('CSV bez danych')
  const header = rows[0]
  console.log(`→ Parsowanie CSV: ${rows.length - 1} wierszy, separator „${delimiter}".`)

  const col = {
    name: findColumn(
      header,
      (h) => h.includes('nazwa miejscowosci') && !h.includes('podstawowej'),
      (h) => h === 'nazwa'
    ),
    rodzaj: findColumn(header, (h) => h.includes('rodzaj')),
    gmina: findColumn(header, (h) => h.includes('gmina') && !h.includes('rodzaj')),
    powiat: findColumn(header, (h) => h.includes('powiat')),
    woj: findColumn(header, (h) => h.includes('wojewodztwo')),
    parent: findColumn(header, (h) => h.includes('podstawowej')),
  }
  console.log('  Kolumny:', JSON.stringify(col), '| nagłówek:', header.join(' | '))
  for (const [k, v] of Object.entries(col)) {
    if (v === -1 && k !== 'parent') throw new Error(`Nie znaleziono kolumny: ${k}`)
  }

  // Mapa powiat→okręg.
  const powiatMap = new Map<string, number>()
  for (const p of OKREGI.powiaty) {
    powiatMap.set(`${normalizePlace(p.woj)}|${normalizePlace(p.powiat)}`, p.okreg)
  }

  const normPowiat = (s: string) => {
    let n = normalizePlace(s.replace(/^(m\.\s*st\.|m\.st\.|m\.|miasto)\s+/i, ''))
    n = POWIAT_ALIASES[n] ?? n
    return n
  }

  const entries: PlaceTuple[] = []
  const seen = new Set<string>()
  const unmatched = new Map<string, number>()
  const usedPowiaty = new Set<string>()
  const typeCounts = new Map<string, number>()
  let unknownType = 0

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = (r[col.name] ?? '').trim()
    if (!name) continue
    const woj = normalizePlace(r[col.woj] ?? '')
    const powiatRaw = (r[col.powiat] ?? '').trim()
    const gmina = (r[col.gmina] ?? '').trim()
    const key = `${woj}|${normPowiat(powiatRaw)}`
    const okreg = powiatMap.get(key)
    if (!okreg) {
      unmatched.set(key, (unmatched.get(key) ?? 0) + 1)
      continue
    }
    usedPowiaty.add(key)

    let type = mapRodzaj(r[col.rodzaj] ?? '')
    if (type === '?') {
      unknownType++
      type = 'os'
    }
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)

    const parent = col.parent !== -1 ? (r[col.parent] ?? '').trim() : ''
    const dedupeKey = `${name}|${type}|${gmina}|${powiatRaw}|${parent}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const tuple: PlaceTuple =
      parent && parent !== name
        ? [name, type, gmina, powiatRaw, (r[col.woj] ?? '').trim(), okreg, parent]
        : [name, type, gmina, powiatRaw, (r[col.woj] ?? '').trim(), okreg]
    entries.push(tuple)
  }

  // --- Walidacja (twarda) ---------------------------------------------------
  const problems: string[] = []
  if (unmatched.size > 0) {
    problems.push(
      `Niezmapowane powiaty (${unmatched.size}): ${[...unmatched.entries()]
        .map(([k, n]) => `${k} (${n} wierszy)`)
        .join(', ')}`
    )
  }
  const unusedEntries = OKREGI.powiaty.filter(
    (p) => !usedPowiaty.has(`${normalizePlace(p.woj)}|${normalizePlace(p.powiat)}`)
  )
  if (unusedEntries.length > 0) {
    problems.push(
      `Wpisy okregi.json bez żadnej miejscowości (${unusedEntries.length}): ${unusedEntries
        .map((p) => `${p.woj}/${p.powiat}`)
        .join(', ')}`
    )
  }
  const okregNums = new Set(entries.map((e) => e[5]))
  if (okregNums.size !== 41) problems.push(`Miejscowości pokrywają ${okregNums.size}/41 okręgów`)
  if (entries.length < 90000 || entries.length > 115000) {
    problems.push(`Łączna liczba miejscowości poza zakresem 90–115 tys.: ${entries.length}`)
  }
  if (unknownType / entries.length > 0.05) {
    problems.push(`Ponad 5% wierszy z nieznanym rodzajem (${unknownType})`)
  }
  // Cross-check z realnymi danymi posłów.
  const mpsPath = path.join(ROOT, 'data', 'mps.json')
  const metaPath = path.join(ROOT, 'data', 'meta.json')
  if (existsSync(mpsPath) && existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { placeholder?: boolean }
    if (!meta.placeholder) {
      const mps = JSON.parse(readFileSync(mpsPath, 'utf8')) as {
        districtNum: number | null
        active: boolean
      }[]
      const badDistrict = mps.filter((m) => m.districtNum != null && (m.districtNum < 1 || m.districtNum > 41))
      if (badDistrict.length > 0) problems.push(`Posłowie z districtNum poza 1..41: ${badDistrict.length}`)
      const mpDistricts = new Set(mps.filter((m) => m.active && m.districtNum != null).map((m) => m.districtNum))
      if (mpDistricts.size !== 41) problems.push(`Aktywni posłowie pokrywają ${mpDistricts.size}/41 okręgów`)
    }
  }

  if (problems.length > 0) {
    console.error('✖ WALIDACJA NIE PRZESZŁA:')
    for (const p of problems) console.error('  - ' + p)
    process.exit(1)
  }

  // --- Emisja ----------------------------------------------------------------
  await fs.rm(OUT_DIR, { recursive: true, force: true })
  await fs.mkdir(OUT_DIR, { recursive: true })

  const chunks = new Map<string, PlaceTuple[]>()
  for (const e of entries) {
    const key = chunkKey(e[0])
    if (!chunks.has(key)) chunks.set(key, [])
    chunks.get(key)!.push(e)
  }
  const collator = new Intl.Collator('pl')
  for (const [key, list] of chunks) {
    list.sort((a, b) => collator.compare(a[0], b[0]))
    await fs.writeFile(path.join(OUT_DIR, `${key}.json`), JSON.stringify(list))
  }
  const manifest = {
    generatedAt: new Date().toISOString(),
    placeholder: false,
    total: entries.length,
    chunks: Object.fromEntries([...chunks.entries()].map(([k, v]) => [k, v.length])),
  }
  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest))

  // --- Podsumowanie ----------------------------------------------------------
  const topChunks = [...chunks.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([k, v]) => `${k}:${v.length}`)
    .join(', ')
  const perOkreg = new Map<number, number>()
  for (const e of entries) perOkreg.set(e[5], (perOkreg.get(e[5]) ?? 0) + 1)
  console.log('✔ Indeks miejscowości zbudowany.')
  console.log(`  Miejscowości: ${entries.length}, chunki: ${chunks.size}, nieznany rodzaj: ${unknownType}`)
  console.log(`  Typy: ${[...typeCounts.entries()].map(([k, v]) => `${k}:${v}`).join(', ')}`)
  console.log(`  Największe chunki: ${topChunks}`)
  console.log(
    `  Okręgi (miejscowości): ${[...perOkreg.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')}`
  )
}

main().catch((err) => {
  console.error('✖ Błąd sync:places:', err.message)
  process.exit(1)
})
