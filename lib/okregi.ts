import 'server-only'
import okregiData from '@/data/okregi.json'
import { clubOrder } from './clubs'
import { getAllMPs } from './data'
import type { MP } from './types'

export interface District {
  num: number
  name: string
  voivodeship: string
}

interface OkregiFile {
  districts: District[]
  powiaty: { woj: string; powiat: string; okreg: number }[]
}

const FILE = okregiData as unknown as OkregiFile

export function getDistricts(): District[] {
  return [...FILE.districts].sort((a, b) => a.num - b.num)
}

export function getDistrict(num: number): District | undefined {
  return FILE.districts.find((d) => d.num === num)
}

/**
 * Nazwa okręgu do wyświetlenia — preferuje nazwę z danych API Sejmu
 * (districtName posłów), z fallbackiem na tabelę okręgów.
 */
export function districtDisplayName(num: number): string {
  const fromMPs = getAllMPs().find(
    (m) => m.districtNum === num && m.districtName && m.districtName !== 'dane demonstracyjne'
  )
  return fromMPs?.districtName ?? getDistrict(num)?.name ?? `Okręg ${num}`
}

/** Aktywni posłowie okręgu, ułożeni wg sceny politycznej, potem alfabetycznie. */
export function getDistrictMPs(num: number): MP[] {
  return getAllMPs()
    .filter((m) => m.active && m.districtNum === num)
    .sort((a, b) => {
      const byClub = clubOrder(a.club) - clubOrder(b.club)
      if (byClub !== 0) return byClub
      return a.lastName.localeCompare(b.lastName, 'pl')
    })
}
