import type { Metadata } from 'next'
import { RepresentationFinder } from '@/components/RepresentationFinder'
import { getClubMeta } from '@/lib/clubs'
import { getMeta } from '@/lib/data'
import { districtDisplayName, getDistricts, getDistrictMPs } from '@/lib/okregi'
import type { MiniMP } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Kto mnie reprezentuje?',
  description:
    'Wpisz nazwę swojej miejscowości, a pokażemy Ci okręg wyborczy i posłów na Sejm, którzy Cię reprezentują.',
}

export default function KtoMnieReprezentujePage() {
  const meta = getMeta()

  const districts: Record<number, { name: string; voivodeship: string }> = {}
  const mpsByDistrict: Record<number, MiniMP[]> = {}
  for (const d of getDistricts()) {
    districts[d.num] = { name: districtDisplayName(d.num), voivodeship: d.voivodeship }
    mpsByDistrict[d.num] = getDistrictMPs(d.num).map((mp) => ({
      id: mp.id,
      name: mp.name,
      club: getClubMeta(mp.club).code,
      hasPhoto: mp.hasPhoto,
    }))
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="mx-auto mb-8 max-w-2xl text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Kto mnie reprezentuje?
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-ink-muted sm:text-base">
          Wpisz nazwę swojej miejscowości, a wskażemy Twój okręg wyborczy i posłów na Sejm, którzy
          reprezentują Twój region.
        </p>
      </section>

      {meta.placeholder ? (
        <p className="mx-auto mb-6 max-w-xl rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-2.5 text-center text-xs leading-relaxed text-amber-900">
          Tryb demonstracyjny: dostępnych jest kilkadziesiąt przykładowych miejscowości, a posłowie
          są zastępczy. Pełna baza (~100 tys. miejscowości) i realne dane pojawiają się po
          synchronizacji przy publikacji.
        </p>
      ) : null}

      <RepresentationFinder districts={districts} mpsByDistrict={mpsByDistrict} />
    </div>
  )
}
