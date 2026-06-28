import { CLUB_META } from './clubs'
import type { ClubCount, DataMeta, MP } from './types'

/**
 * Generuje DEMONSTRACYJNY (placeholder) zestaw danych, gdy nie uruchomiono
 * jeszcze synchronizacji z API Sejmu (`npm run sync`). Liczebności klubów są
 * zbliżone do realnego rozkładu X kadencji, dzięki czemu układ sali wygląda
 * wiarygodnie. Realne dane + zdjęcia pobiera skrypt synchronizacji w CI.
 */
const SEED_COUNTS: Record<string, number> = {
  PiS: 186,
  KO: 156,
  'PSL-TD': 32,
  Lewica: 21,
  Konfederacja: 16,
  'Polska2050-TD': 15,
  Centrum: 11,
  'niez.': 12,
  Demokracja: 4,
  Razem: 4,
  KonfederacjaKP: 3,
}

export function generateSeed(asOf = '01.06.2026'): {
  mps: MP[]
  clubs: ClubCount[]
  meta: DataMeta
} {
  const mps: MP[] = []
  let id = 1
  for (const code of Object.keys(SEED_COUNTS)) {
    const count = SEED_COUNTS[code]
    for (let i = 1; i <= count; i++) {
      mps.push({
        id,
        firstName: 'Poseł',
        lastName: `#${id}`,
        name: `Poseł #${id}`,
        club: code,
        districtName: 'dane demonstracyjne',
        districtNum: null,
        voivodeship: '',
        profession: '',
        birthDate: null,
        birthLocation: '',
        educationLevel: '',
        email: '',
        numberOfVotes: null,
        active: true,
        hasPhoto: false,
      })
      id++
    }
  }

  const clubs = buildClubCounts(mps)
  const meta: DataMeta = {
    placeholder: true,
    generatedAt: new Date('2026-06-01T00:00:00Z').toISOString(),
    term: 10,
    asOf,
  }
  return { mps, clubs, meta }
}

export function buildClubCounts(mps: MP[]): ClubCount[] {
  const counts = new Map<string, number>()
  for (const mp of mps) counts.set(mp.club, (counts.get(mp.club) ?? 0) + 1)

  return [...counts.entries()]
    .map(([code, count]) => {
      const meta = CLUB_META[code] ?? { code, name: code, color: '#94a3b8', order: 90 }
      return { ...meta, count }
    })
    .sort((a, b) => a.order - b.order)
}
