'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  fetchLegislationList,
  INITIATOR_LABELS,
  matchesProcess,
  STAGE_META,
  STATUS_META,
  type Initiator,
  type ProcessStatus,
  type ProcessSummary,
} from '@/lib/legislation'

const STATUS_FILTERS: { key: ProcessStatus; label: string }[] = [
  { key: 'w_toku', label: 'W toku' },
  { key: 'uchwalona', label: 'Uchwalone' },
  { key: 'odrzucona', label: 'Odrzucone' },
  { key: 'zakonczona', label: 'Zakończone' },
]

/**
 * Wyszukiwarka i lista projektów ustaw. Ładuje zbiorczą listę raz i filtruje
 * lokalnie (substring po tytule + facety statusu i inicjatora). Kafle linkują
 * do statycznej strony szczegółów /ustawa/{num}.
 */
export function LegislationSearch() {
  const [list, setList] = useState<ProcessSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ProcessStatus | null>(null)
  const [initiator, setInitiator] = useState<Initiator | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchLegislationList().then((l) => {
      if (cancelled) return
      if (l) setList(l)
      else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const initiators = useMemo(() => {
    if (!list) return [] as Initiator[]
    return [...new Set(list.map((p) => p.initiator))]
  }, [list])

  const filtered = useMemo(() => {
    if (!list) return []
    return list.filter(
      (p) =>
        matchesProcess(p, query) &&
        (!status || p.status === status) &&
        (!initiator || p.initiator === initiator)
    )
  }, [list, query, status, initiator])

  if (failed) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-center">
        <p className="text-sm text-ink-muted">Nie udało się wczytać listy projektów ustaw.</p>
        <button
          type="button"
          onClick={() => {
            setFailed(false)
            setList(null)
            fetchLegislationList(true).then((l) => (l ? setList(l) : setFailed(true)))
          }}
          className="mt-3 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink-soft"
        >
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  if (!list) {
    return <div className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" aria-hidden="true" />
  }

  return (
    <div>
      <label className="block">
        <span className="sr-only">Szukaj projektu ustawy</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={'Szukaj po tytule (np. „energia", „oświata")…'}
          className="w-full rounded-xl border border-black/10 bg-white/90 px-4 py-2.5 text-sm font-medium text-ink shadow-sm outline-none transition-shadow placeholder:font-normal placeholder:text-ink-muted/70 focus:border-ink/30 focus:shadow-soft"
        />
      </label>

      {/* Facety statusu */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtr statusu">
        <FacetChip active={status === null} onClick={() => setStatus(null)}>
          Wszystkie
        </FacetChip>
        {STATUS_FILTERS.map((f) => (
          <FacetChip key={f.key} active={status === f.key} onClick={() => setStatus(status === f.key ? null : f.key)}>
            {f.label}
          </FacetChip>
        ))}
      </div>

      {/* Facety inicjatora */}
      {initiators.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filtr inicjatora">
          {initiators.map((i) => (
            <FacetChip key={i} active={initiator === i} onClick={() => setInitiator(initiator === i ? null : i)}>
              {INITIATOR_LABELS[i]}
            </FacetChip>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs text-ink-muted">
        {filtered.length === list.length
          ? `${list.length} ${plProjekty(list.length)} ustaw`
          : `${filtered.length} z ${list.length} ${plProjekty(list.length)}`}
      </p>

      <ul className="mt-2 space-y-2">
        {filtered.map((p) => (
          <li key={p.num}>
            <Link
              href={`/ustawa/${p.num}`}
              className="block rounded-2xl border border-black/5 bg-white/80 p-4 shadow-soft transition-shadow hover:shadow-card"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_META[p.status].tone}`}>
                  {STATUS_META[p.status].label}
                </span>
                <span className="text-[11px] font-medium text-ink-muted">{INITIATOR_LABELS[p.initiator]}</span>
                <span className="ml-auto text-[11px] text-ink-muted">
                  etap: {STAGE_META[p.lastStage].short}
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-semibold leading-snug text-ink">{p.title}</h3>
              <p className="mt-0.5 text-xs text-ink-muted">Druk nr {p.num}</p>
            </Link>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="rounded-2xl border border-black/10 bg-white/70 px-4 py-6 text-center text-sm text-ink-muted">
            Brak projektów pasujących do wyszukiwania.
          </li>
        ) : null}
      </ul>
    </div>
  )
}

/** Polska odmiana rzeczownika „projekt" przez liczbę. */
function plProjekty(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (n === 1) return 'projekt'
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'projekty'
  return 'projektów'
}

function FacetChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-black/10 bg-white/80 text-ink-soft hover:bg-black/[0.04]'
      }`}
    >
      {children}
    </button>
  )
}
