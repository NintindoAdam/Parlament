import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MPCard } from '@/components/MPCard'
import { getClubMeta } from '@/lib/clubs'
import { districtDisplayName, getDistrict, getDistricts, getDistrictMPs } from '@/lib/okregi'

export function generateStaticParams() {
  return getDistricts().map((d) => ({ nr: String(d.num) }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nr: string }>
}): Promise<Metadata> {
  const { nr } = await params
  const district = getDistrict(Number(nr))
  if (!district) return { title: 'Nie znaleziono okręgu' }
  const name = districtDisplayName(district.num)
  return {
    title: `Okręg nr ${district.num} — ${name}`,
    description: `Posłowie na Sejm z okręgu wyborczego nr ${district.num} (${name}, woj. ${district.voivodeship}).`,
  }
}

export default async function OkregPage({ params }: { params: Promise<{ nr: string }> }) {
  const { nr } = await params
  const district = getDistrict(Number(nr))
  if (!district) notFound()

  const name = districtDisplayName(district.num)
  const mps = getDistrictMPs(district.num).map((mp) => ({
    id: mp.id,
    name: mp.name,
    club: getClubMeta(mp.club).code,
    hasPhoto: mp.hasPhoto,
  }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/kto-mnie-reprezentuje"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 12H5m6 6-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Wyszukiwarka miejscowości
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex h-20 w-20 flex-none flex-col items-center justify-center rounded-2xl bg-ink text-white shadow-soft">
          <span className="text-[10px] font-medium uppercase tracking-widest text-white/60">Okręg</span>
          <span className="font-display text-3xl font-bold leading-none">{district.num}</span>
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Okręg wyborczy nr {district.num} — {name}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            województwo {district.voivodeship} · {mps.length} {mps.length === 1 ? 'poseł' : 'posłów'}
          </p>
        </div>
      </div>

      <h2 className="mb-3 mt-9 font-display text-lg font-semibold tracking-tight text-ink">
        Posłowie z okręgu
      </h2>
      {mps.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mps.map((mp) => (
            <li key={mp.id}>
              <MPCard mp={mp} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-black/5 bg-white/70 p-5 text-sm text-ink-muted">
          Brak danych o posłach z tego okręgu.
        </p>
      )}
    </div>
  )
}
