import Link from 'next/link'
import type { AttendanceStats, ClubMeta, MP, WikiInfo } from '@/lib/types'
import { Photo } from './Photo'

interface AttendanceMeta {
  totalVotings: number
  lastVotingDate: string
  placeholder: boolean
}

interface MemberProfileProps {
  mp: MP
  club: ClubMeta
  wiki: WikiInfo | null
  attendance: AttendanceStats | null
  attendanceMeta: AttendanceMeta | null
}

export function MemberProfile({ mp, club, wiki, attendance, attendanceMeta }: MemberProfileProps) {
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

      {attendance && attendance.total > 0 ? (
        <VotingActivity attendance={attendance} meta={attendanceMeta} />
      ) : null}

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

/**
 * Sekcja „Aktywność w głosowaniach": frekwencja (KPI + pasek) i kafelki
 * rozkładu głosów. Wartości liczbowe w sans semibold (nie serif), tekst
 * w tonacji ink — kolor niosą wyłącznie znaczniki (kropki, wypełnienie paska).
 */
function VotingActivity({
  attendance,
  meta,
}: {
  attendance: AttendanceStats
  meta: AttendanceMeta | null
}) {
  const pct = (attendance.cast / attendance.total) * 100
  const pctLabel = pct.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const nf = (n: number) => n.toLocaleString('pl-PL')

  const tiles: { label: string; value: number; dot: string }[] = [
    { label: 'Za', value: attendance.yes, dot: '#059669' },
    { label: 'Przeciw', value: attendance.no, dot: '#e11d48' },
    { label: 'Wstrzymał(a) się', value: attendance.abstain, dot: '#d97706' },
    { label: 'Nieobecność', value: attendance.absent, dot: '#7c5cdb' },
  ]

  return (
    <section className="mt-6 rounded-3xl border border-black/5 bg-white/70 p-6 shadow-soft backdrop-blur-sm sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Aktywność w głosowaniach
        </h2>
        {meta ? (
          <p className="text-xs text-ink-muted">
            stan na {formatDate(meta.lastVotingDate)}
            {meta.placeholder ? ' · dane demonstracyjne' : ''}
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] sm:items-center">
        {/* KPI: frekwencja */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Frekwencja</p>
          <p className="mt-1 font-sans text-4xl font-semibold text-ink">
            {pctLabel}
            <span className="ml-0.5 text-2xl text-ink-muted">%</span>
          </p>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/10"
            role="progressbar"
            aria-valuenow={Math.round(pct * 10) / 10}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Frekwencja w głosowaniach: ${pctLabel}%`}
          >
            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Oddane głosy: <span className="font-semibold text-ink-soft">{nf(attendance.cast)}</span> z{' '}
            {nf(attendance.total)} głosowań
          </p>
        </div>

        {/* Kafelki rozkładu głosów */}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl border border-black/5 bg-white/80 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ backgroundColor: t.dot }}
                  aria-hidden="true"
                />
                {t.label}
              </dt>
              <dd className="mt-1 font-sans text-lg font-semibold leading-none text-ink">
                {nf(t.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
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
