/**
 * Zapisuje DEMONSTRACYJNY zestaw danych do `data/`, aby projekt budował się i
 * uruchamiał lokalnie bez dostępu do API Sejmu. W CI realne dane nadpisuje
 * `npm run sync`. Uruchomienie: `npm run seed`.
 */
import { promises as fs } from 'fs'
import path from 'path'
import { generateSeed } from '../lib/seed'
import { chunkKey, type PlaceTuple } from '../lib/places'
import type { AttendanceFile, MP } from '../lib/types'

/**
 * Demonstracyjny indeks miejscowości (realne miejscowości z poprawnymi
 * okręgami — obejmuje przypadki brzegowe: duplikaty nazw, myślniki,
 * diakrytyki, część miasta). Pełną bazę ~103 tys. buduje `npm run sync:places`.
 */
const SEED_PLACES: PlaceTuple[] = [
  ['Warszawa', 'm', 'Warszawa', 'Warszawa', 'mazowieckie', 19],
  ['Mokotów', 'cz', 'Warszawa', 'Warszawa', 'mazowieckie', 19, 'Warszawa'],
  ['Kraków', 'm', 'Kraków', 'Kraków', 'małopolskie', 13],
  ['Łódź', 'm', 'Łódź', 'Łódź', 'łódzkie', 9],
  ['Wrocław', 'm', 'Wrocław', 'Wrocław', 'dolnośląskie', 3],
  ['Poznań', 'm', 'Poznań', 'Poznań', 'wielkopolskie', 39],
  ['Gdańsk', 'm', 'Gdańsk', 'Gdańsk', 'pomorskie', 25],
  ['Gdynia', 'm', 'Gdynia', 'Gdynia', 'pomorskie', 26],
  ['Sopot', 'm', 'Sopot', 'Sopot', 'pomorskie', 25],
  ['Szczecin', 'm', 'Szczecin', 'Szczecin', 'zachodniopomorskie', 41],
  ['Świnoujście', 'm', 'Świnoujście', 'Świnoujście', 'zachodniopomorskie', 41],
  ['Bydgoszcz', 'm', 'Bydgoszcz', 'Bydgoszcz', 'kujawsko-pomorskie', 4],
  ['Toruń', 'm', 'Toruń', 'Toruń', 'kujawsko-pomorskie', 5],
  ['Lublin', 'm', 'Lublin', 'Lublin', 'lubelskie', 6],
  ['Katowice', 'm', 'Katowice', 'Katowice', 'śląskie', 31],
  ['Białystok', 'm', 'Białystok', 'Białystok', 'podlaskie', 24],
  ['Częstochowa', 'm', 'Częstochowa', 'Częstochowa', 'śląskie', 28],
  ['Radom', 'm', 'Radom', 'Radom', 'mazowieckie', 17],
  ['Kielce', 'm', 'Kielce', 'Kielce', 'świętokrzyskie', 33],
  ['Rzeszów', 'm', 'Rzeszów', 'Rzeszów', 'podkarpackie', 23],
  ['Olsztyn', 'm', 'Olsztyn', 'Olsztyn', 'warmińsko-mazurskie', 35],
  ['Opole', 'm', 'Opole', 'Opole', 'opolskie', 21],
  ['Zielona Góra', 'm', 'Zielona Góra', 'Zielona Góra', 'lubuskie', 8],
  ['Legnica', 'm', 'Legnica', 'Legnica', 'dolnośląskie', 1],
  ['Bielsko-Biała', 'm', 'Bielsko-Biała', 'Bielsko-Biała', 'śląskie', 27],
  ['Kudowa-Zdrój', 'm', 'Kudowa-Zdrój', 'kłodzki', 'dolnośląskie', 2],
  ['Zakopane', 'm', 'Zakopane', 'tatrzański', 'małopolskie', 14],
  ['Hel', 'm', 'Hel', 'pucki', 'pomorskie', 26],
  ['Kazimierz Dolny', 'm', 'Kazimierz Dolny', 'puławski', 'lubelskie', 6],
  ['Nowa Wieś', 'w', 'Kęty', 'oświęcimski', 'małopolskie', 12],
  ['Nowa Wieś', 'w', 'Michałowice', 'pruszkowski', 'mazowieckie', 20],
]

async function writeSeedPlaces(publicDir: string) {
  const placesDir = path.join(publicDir, 'places')
  await fs.rm(placesDir, { recursive: true, force: true })
  await fs.mkdir(placesDir, { recursive: true })

  const chunks = new Map<string, PlaceTuple[]>()
  for (const t of SEED_PLACES) {
    const key = chunkKey(t[0])
    if (!chunks.has(key)) chunks.set(key, [])
    chunks.get(key)!.push(t)
  }
  const manifest = {
    generatedAt: new Date('2026-06-01T00:00:00Z').toISOString(),
    placeholder: true,
    total: SEED_PLACES.length,
    chunks: Object.fromEntries([...chunks.entries()].map(([k, v]) => [k, v.length])),
  }
  for (const [key, entries] of chunks) {
    await fs.writeFile(path.join(placesDir, `${key}.json`), JSON.stringify(entries))
  }
  await fs.writeFile(path.join(placesDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return SEED_PLACES.length
}

/** Deterministyczna demonstracyjna frekwencja (zależna od id — bez losowości). */
function buildSeedAttendance(mps: MP[]): AttendanceFile {
  const totalVotings = 1200
  const perMP: AttendanceFile['perMP'] = {}
  for (const mp of mps) {
    const pct = 78 + ((mp.id * 7) % 22) // 78–99%
    const total = totalVotings
    const cast = Math.round((total * pct) / 100)
    const absent = total - cast
    const yes = Math.round(cast * 0.55)
    const no = Math.round(cast * 0.35)
    const abstain = cast - yes - no
    perMP[String(mp.id)] = { total, cast, yes, no, abstain, absent }
  }
  return {
    generatedAt: new Date('2026-06-01T00:00:00Z').toISOString(),
    placeholder: true,
    totalVotings,
    lastVotingDate: '2026-06-01',
    perMP,
  }
}

async function main() {
  const dataDir = path.join(process.cwd(), 'data')
  await fs.mkdir(dataDir, { recursive: true })

  const { mps, clubs, meta } = generateSeed()

  await fs.writeFile(path.join(dataDir, 'mps.json'), JSON.stringify(mps, null, 2))
  await fs.writeFile(path.join(dataDir, 'clubs.json'), JSON.stringify(clubs, null, 2))
  await fs.writeFile(path.join(dataDir, 'meta.json'), JSON.stringify(meta, null, 2))

  await fs.writeFile(
    path.join(dataDir, 'attendance.json'),
    JSON.stringify(buildSeedAttendance(mps), null, 2)
  )

  const placesCount = await writeSeedPlaces(path.join(process.cwd(), 'public'))

  console.log(`✔ Zapisano dane demonstracyjne: ${mps.length} posłów, ${clubs.length} klubów, ${placesCount} miejscowości.`)
  console.log('  Aby pobrać realne dane + zdjęcia, uruchom `npm run sync`, a pełny indeks miejscowości — `npm run sync:places`.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
