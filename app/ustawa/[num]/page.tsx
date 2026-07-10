import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LegislativeTimeline } from '@/components/LegislativeTimeline'
import {
  daysStale,
  formatDate,
  FREEZER_DAYS,
  INITIATOR_LABELS,
  isFrozen,
  STATUS_META,
} from '@/lib/legislation'
import { getAllProcesses, getProcess } from '@/lib/legislation-data'

export function generateStaticParams() {
  return getAllProcesses().map((p) => ({ num: p.num }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ num: string }>
}): Promise<Metadata> {
  const { num } = await params
  const proc = getProcess(num)
  if (!proc) return { title: 'Nie znaleziono projektu ustawy' }
  return {
    title: proc.title,
    description: `${INITIATOR_LABELS[proc.initiator]} · ${STATUS_META[proc.status].label}. Prześledź drogę tego projektu ustawy przez Sejm.`,
  }
}

export default async function UstawaPage({ params }: { params: Promise<{ num: string }> }) {
  const { num } = await params
  const proc = getProcess(num)
  if (!proc) notFound()

  const sejmUrl = `https://www.sejm.gov.pl/Sejm10.nsf/PrzebiegProc.xsp?nr=${proc.num}`

  const lastActivity = proc.steps.reduce((m, s) => (s.date && s.date > m ? s.date : m), '') || proc.startDate
  const nowISO = new Date().toISOString()
  const frozen = isFrozen(proc.status, lastActivity, nowISO)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/jak-powstaje-ustawa"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> Wszystkie projekty ustaw
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_META[proc.status].tone}`}>
            {STATUS_META[proc.status].label}
          </span>
          <span className="text-xs font-medium text-ink-muted">{INITIATOR_LABELS[proc.initiator]}</span>
          <span className="text-xs text-ink-muted">Druk nr {proc.num}</span>
        </div>
        <h1 className="mt-2 text-pretty font-display text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
          {proc.title}
        </h1>
        {proc.description ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{proc.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-ink-muted">
          {proc.startDate ? <>Wpłynął {formatDate(proc.startDate)}</> : null}
          {proc.dziennikUstaw ? <> · opublikowano: {proc.dziennikUstaw}</> : null}
        </p>
        {frozen ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs leading-relaxed text-sky-900">
            <span aria-hidden="true" className="text-sm">❄️</span>
            <span>
              <span className="font-semibold">W zamrażarce sejmowej.</span> Ten projekt jest w toku,
              ale od {daysStale(lastActivity, nowISO)} dni (ostatni ruch: {formatDate(lastActivity)})
              nie nadano mu dalszego biegu.
            </span>
          </div>
        ) : null}
      </header>

      <section className="mt-8 rounded-3xl border border-black/5 bg-white/70 p-6 shadow-soft backdrop-blur-sm sm:p-8">
        <h2 className="mb-6 font-display text-lg font-semibold tracking-tight text-ink">
          Droga tego projektu
        </h2>
        <LegislativeTimeline record={proc} />
      </section>

      <section className="mt-6 rounded-2xl border border-black/5 bg-white/60 p-5 text-sm">
        <h2 className="font-display text-sm font-semibold text-ink">Źródło</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Dane pochodzą z oficjalnego API Sejmu RP. Pełny przebieg procesu wraz z drukami i
          dokumentami znajdziesz na stronie Sejmu.
        </p>
        <a
          href={sejmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-black/[0.04]"
        >
          Przebieg procesu na sejm.gov.pl
          <span aria-hidden="true">↗</span>
        </a>
      </section>
    </div>
  )
}
