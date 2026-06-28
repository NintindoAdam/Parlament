/**
 * Zapisuje DEMONSTRACYJNY zestaw danych do `data/`, aby projekt budował się i
 * uruchamiał lokalnie bez dostępu do API Sejmu. W CI realne dane nadpisuje
 * `npm run sync`. Uruchomienie: `npm run seed`.
 */
import { promises as fs } from 'fs'
import path from 'path'
import { generateSeed } from '../lib/seed'

async function main() {
  const dataDir = path.join(process.cwd(), 'data')
  await fs.mkdir(dataDir, { recursive: true })

  const { mps, clubs, meta } = generateSeed()

  await fs.writeFile(path.join(dataDir, 'mps.json'), JSON.stringify(mps, null, 2))
  await fs.writeFile(path.join(dataDir, 'clubs.json'), JSON.stringify(clubs, null, 2))
  await fs.writeFile(path.join(dataDir, 'meta.json'), JSON.stringify(meta, null, 2))

  console.log(`✔ Zapisano dane demonstracyjne: ${mps.length} posłów, ${clubs.length} klubów.`)
  console.log('  Aby pobrać realne dane + zdjęcia, uruchom `npm run sync`.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
