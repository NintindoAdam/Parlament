import { ParliamentMap } from '@/components/ParliamentMap'
import { getClubCounts, getClubMeta, getMeta, getSeating } from '@/lib/data'
import type { SeatDatum } from '@/lib/types'

export default function HomePage() {
  const meta = getMeta()
  const clubs = getClubCounts()
  const { layout, seated } = getSeating()

  const seats: SeatDatum[] = seated.map(({ mp, seat }) => {
    const club = getClubMeta(mp.club)
    return {
      id: mp.id,
      name: mp.name,
      club: club.code,
      clubName: club.name,
      color: club.color,
      district: mp.districtName,
      districtNum: mp.districtNum,
      voivodeship: mp.voivodeship,
      profession: mp.profession,
      hasPhoto: mp.hasPhoto,
      x: Math.round(seat.x * 100) / 100,
      y: Math.round(seat.y * 100) / 100,
    }
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <section className="mx-auto mb-7 max-w-2xl text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Kto siedzi w Sejmie?
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-ink-muted sm:text-base">
          Interaktywny plan sali posiedzeń. Najedź na dowolne miejsce, aby poznać posła, jego klub i
          okręg wyborczy — kliknij, by otworzyć pełny profil.
        </p>
      </section>

      {meta.placeholder ? <DemoBanner /> : null}

      <ParliamentMap
        width={layout.width}
        height={layout.height}
        seatRadius={layout.seatRadius}
        seats={seats}
        clubs={clubs}
      />
    </div>
  )
}

function DemoBanner() {
  return (
    <div className="mx-auto mb-6 flex max-w-2xl items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 shadow-sm">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-none" aria-hidden="true">
        <path d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="leading-relaxed">
        <strong className="font-semibold">Dane demonstracyjne.</strong> Rozkład klubów jest zbliżony
        do rzeczywistego, ale nazwiska i zdjęcia są zastępcze. Realne dane pobierze synchronizacja z
        API Sejmu (<code className="rounded bg-amber-100 px-1 py-0.5 text-[12px]">npm run sync</code>)
        — w publikacji na GitHub Pages dzieje się to automatycznie.
      </p>
    </div>
  )
}
