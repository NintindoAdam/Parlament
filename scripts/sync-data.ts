/**
 * Synchronizacja danych z oficjalnego API Sejmu (+ biografie z Wikipedii).
 *
 * Pobiera listę posłów wskazanej kadencji, zapisuje znormalizowane dane do
 * `data/`, ściąga zdjęcia do `public/photos*` oraz streszczenia z Wikipedii do
 * `data/wiki/`. Idempotentne — pomija już pobrane zdjęcia.
 *
 * Uruchomienie:  npm run sync
 * Konfiguracja:  SEJM_TERM (domyślnie 10), DATA_AS_OF (np. „28.06.2026").
 *
 * Skrypt projektowany do uruchamiania w GitHub Actions (runner ma otwarty
 * dostęp do sieci). Lokalnie zadziała wszędzie tam, gdzie api.sejm.gov.pl jest
 * osiągalne.
 */
import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import path from 'path'
import { buildClubCounts } from '../lib/seed'
import { normalizeClub } from '../lib/clubs'
import type { ClubCount, DataMeta, MP, WikiInfo } from '../lib/types'

const TERM = Number(process.env.SEJM_TERM ?? '10')
const API = `https://api.sejm.gov.pl/sejm/term${TERM}`
const UA = 'Parlament-app/1.0 (https://github.com/NintindoAdam/Parlament; educational)'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'data')
const WIKI_DIR = path.join(DATA_DIR, 'wiki')
const PHOTO_DIR = path.join(ROOT, 'public', 'photos')
const PHOTO_MINI_DIR = path.join(ROOT, 'public', 'photos-mini')

interface RawMP {
  id: number
  firstName?: string
  lastName?: string
  firstLastName?: string
  club?: string
  districtName?: string
  districtNum?: number
  voivodeship?: string
  profession?: string
  birthDate?: string
  birthLocation?: string
  educationLevel?: string
  email?: string
  numberOfVotes?: number
  active?: boolean
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return (await res.json()) as T
}

/** Prosty limiter współbieżności dla zadań asynchronicznych. */
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

function normalizeMP(raw: RawMP): MP {
  const firstName = raw.firstName ?? ''
  const lastName = raw.lastName ?? ''
  const name = raw.firstLastName ?? `${firstName} ${lastName}`.trim()
  return {
    id: raw.id,
    firstName,
    lastName,
    name,
    club: normalizeClub(raw.club),
    districtName: raw.districtName ?? '',
    districtNum: raw.districtNum ?? null,
    voivodeship: raw.voivodeship ?? '',
    profession: raw.profession ?? '',
    birthDate: raw.birthDate ?? null,
    birthLocation: raw.birthLocation ?? '',
    educationLevel: raw.educationLevel ?? '',
    email: raw.email ?? '',
    numberOfVotes: raw.numberOfVotes ?? null,
    active: raw.active ?? true,
    hasPhoto: false,
  }
}

async function downloadPhoto(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) return true
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return false
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) return false
    await fs.writeFile(dest, buf)
    return true
  } catch {
    return false
  }
}

async function fetchWiki(mp: MP): Promise<WikiInfo | null> {
  const candidates = [`${mp.firstName} ${mp.lastName}`, `${mp.firstName} ${mp.lastName} (polityk)`]
  for (const title of candidates) {
    try {
      const url = `https://pl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!res.ok) continue
      const data = (await res.json()) as {
        type?: string
        extract?: string
        content_urls?: { desktop?: { page?: string } }
      }
      if (data.type === 'disambiguation' || !data.extract) continue
      return {
        extract: data.extract,
        url: data.content_urls?.desktop?.page ?? `https://pl.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      }
    } catch {
      // próbujemy kolejnego kandydata
    }
  }
  return null
}

async function main() {
  console.log(`→ Pobieranie posłów (kadencja ${TERM}) z ${API}/MP …`)
  const raw = await fetchJson<RawMP[]>(`${API}/MP`)
  const mps = raw.map(normalizeMP)
  console.log(`  Pobrano ${mps.length} posłów.`)

  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(WIKI_DIR, { recursive: true })
  await fs.mkdir(PHOTO_DIR, { recursive: true })
  await fs.mkdir(PHOTO_MINI_DIR, { recursive: true })

  console.log('→ Pobieranie zdjęć …')
  let photos = 0
  await pool(mps, 8, async (mp) => {
    const okMini = await downloadPhoto(`${API}/MP/${mp.id}/photo-mini`, path.join(PHOTO_MINI_DIR, `${mp.id}.jpg`))
    const okFull = await downloadPhoto(`${API}/MP/${mp.id}/photo`, path.join(PHOTO_DIR, `${mp.id}.jpg`))
    mp.hasPhoto = okFull || okMini
    if (mp.hasPhoto) photos++
  })
  console.log(`  Zapisano zdjęcia dla ${photos}/${mps.length} posłów.`)

  console.log('→ Pobieranie biografii z Wikipedii …')
  let bios = 0
  await pool(mps, 6, async (mp) => {
    const dest = path.join(WIKI_DIR, `${mp.id}.json`)
    if (existsSync(dest)) {
      bios++
      return
    }
    const wiki = await fetchWiki(mp)
    if (wiki) {
      await fs.writeFile(dest, JSON.stringify(wiki, null, 2))
      bios++
    }
  })
  console.log(`  Zapisano biografie dla ${bios}/${mps.length} posłów.`)

  const clubs: ClubCount[] = buildClubCounts(mps)
  const meta: DataMeta = {
    placeholder: false,
    generatedAt: new Date().toISOString(),
    term: TERM,
    asOf: process.env.DATA_AS_OF ?? formatToday(),
  }

  await fs.writeFile(path.join(DATA_DIR, 'mps.json'), JSON.stringify(mps, null, 2))
  await fs.writeFile(path.join(DATA_DIR, 'clubs.json'), JSON.stringify(clubs, null, 2))
  await fs.writeFile(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2))

  console.log('✔ Synchronizacja zakończona.')
  console.log(`  Kluby: ${clubs.map((c) => `${c.code} ${c.count}`).join(', ')}`)
}

function formatToday(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

main().catch((err) => {
  console.error('✖ Błąd synchronizacji:', err.message)
  process.exit(1)
})
