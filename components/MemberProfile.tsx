import Link from 'next/link'
import type { ClubMeta, MP, WikiInfo } from '@/lib/types'
import { Photo } from './Photo'

interface MemberProfileProps {
  mp: MP
  club: ClubMeta
  wiki: WikiInfo | null
}

export function MemberProfile({ mp, club, wiki }: MemberProfileProps) {
  const details: { label: string; value: string }[] = [
    {
      label: 'Okręg wyborczy',
      value: mp.districtName ? `${mp.districtName}${mp.districtNum ? ` (nr ${mp.districtNum})` : ''}` : '',
    },
    { label: 'Województwo', value: cap(mp.voivodeship) },
    { label: 'Zawód', value: mp.profession },
    { label: 'Wykształcenie', value: mp.educationLevel },
    { label: 'Data urodzenia', value: formatDate(mp.birthDate) },
    { label: 'Miejsce urodzenia', value: mp.birthLocation },
    { label: 'Liczba głosów', value: mp.numberOfVotes != null ? mp.numberOfVotes.toLocaleString('pl-PL') : '' },
  ].filter((d) => d.value)

  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 12H5m6 6-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Sala posiedzeń
      </Link>

      <div className="overflow-hidden rounded-3xl border border-black/5 bg-white/80 shadow-card backdrop-blur-sm">
        <div className="h-2 w-full" style={{ backgroundColor: club.color }} />
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:gap-7 sm:p-8">
          <Photo
            id={mp.id}
            name={mp.name}
            full
            hasPhoto={mp.hasPhoto}
            color={club.color}
            className="mx-auto h-40 w-40 flex-none rounded-2xl shadow-soft ring-1 ring-black/10 sm:mx-0"
          />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink">
              {mp.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold text-white"
                style={{ backgroundColor: club.color }}
              >
                {club.name}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  mp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-black/5 text-ink-muted'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${mp.active ? 'bg-emerald-500' : 'bg-ink-muted'}`} />
                {mp.active ? 'Mandat aktywny' : 'Mandat wygasły'}
              </span>
            </div>

            {mp.email ? (
              <a
                href={`mailto:${mp.email}`}
                className="mt-3 inline-block text-sm font-medium text-ink-soft underline decoration-black/20 underline-offset-2 hover:decoration-black/50"
              >
                {mp.email}
              </a>
            ) : null}
          </div>
        </div>

        {details.length > 0 ? (
          <dl className="grid grid-cols-1 gap-px border-t border-black/5 bg-black/5 sm:grid-cols-2">
            {details.map((d) => (
              <div key={d.label} className="bg-white/80 px-6 py-4 sm:px-8">
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{d.label}</dt>
                <dd className="mt-1 font-display text-[15px] font-medium text-ink">{d.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {wiki ? (
        <section className="mt-6 rounded-3xl border border-black/5 bg-white/70 p-6 shadow-soft backdrop-blur-sm sm:p-8">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Biografia</h2>
          <p className="mt-3 text-pretty leading-relaxed text-ink-soft">{wiki.extract}</p>
          <a
            href={wiki.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Czytaj w Wikipedii
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 17 17 7m0 0H8m9 0v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </section>
      ) : null}
    </article>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

function cap(s: string): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
