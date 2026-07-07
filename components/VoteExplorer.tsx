'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ClubCount, SeatDatum } from '@/lib/types'
import {
  expandVotes,
  fetchSittingIndex,
  fetchVotingDetail,
  fetchVotingsManifest,
  formatVoteParam,
  parseVoteParam,
  VOTE_META,
  type SittingIndex,
  type VotingDetail,
  type VotingsManifest,
} from '@/lib/votings'
import { ParliamentMap, type VoteView } from './ParliamentMap'
import { VotingPicker } from './VotingPicker'

type Mode = 'clubs' | 'votes'

interface VoteExplorerProps {
  width: number
  height: number
  seatRadius: number
  hitRadius: number
  seats: SeatDatum[]
  clubs: ClubCount[]
}

/**
 * Strona główna: przełącznik „Kluby" / „Jak głosowali?". W trybie głosowań
 * dwa filtry (posiedzenie → głosowanie) przemalowują salę indywidualnymi
 * głosami posłów. Wybór zapisywany w URL (?g=posiedzenie-głosowanie).
 */
export function VoteExplorer(props: VoteExplorerProps) {
  const [mode, setMode] = useState<Mode>('clubs')
  const [manifest, setManifest] = useState<VotingsManifest | null>(null)
  const [manifestFailed, setManifestFailed] = useState(false)
  const [sitting, setSitting] = useState<number | null>(null)
  const [index, setIndex] = useState<SittingIndex | null>(null)
  const [indexLoading, setIndexLoading] = useState(false)
  const [votingNum, setVotingNum] = useState<number | null>(null)
  const [detail, setDetail] = useState<VotingDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [restored, setRestored] = useState(false)

  // Odtworzenie z URL (?g=47-12). window.location.search zamiast
  // useSearchParams — unika pułapki Suspense przy statycznym eksporcie.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('g')
    const parsed = raw ? parseVoteParam(raw) : null
    if (parsed) {
      setMode('votes')
      setSitting(parsed.sitting)
      setVotingNum(parsed.voting)
    }
    setRestored(true)
  }, [])

  // Manifest pobierany leniwie przy wejściu w tryb głosowań.
  useEffect(() => {
    if (mode !== 'votes' || manifest) return
    let cancelled = false
    fetchVotingsManifest().then((m) => {
      if (cancelled) return
      if (!m) {
        setManifestFailed(true)
        return
      }
      setManifest(m)
      setSitting((current) => current ?? m.sittings[0]?.num ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [mode, manifest])

  // Indeks wybranego posiedzenia.
  useEffect(() => {
    if (mode !== 'votes' || sitting == null) return
    let cancelled = false
    setIndexLoading(true)
    setFailed(false)
    fetchSittingIndex(sitting).then((idx) => {
      if (cancelled) return
      setIndex(idx)
      setIndexLoading(false)
      if (!idx) setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [mode, sitting])

  // Szczegóły wybranego głosowania.
  useEffect(() => {
    if (mode !== 'votes' || sitting == null || votingNum == null) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setFailed(false)
    fetchVotingDetail(sitting, votingNum).then((d) => {
      if (cancelled) return
      setDetail(d)
      setDetailLoading(false)
      if (!d) setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [mode, sitting, votingNum])

  // Synchronizacja URL.
  useEffect(() => {
    if (!restored) return
    const url = new URL(window.location.href)
    if (mode === 'votes' && sitting != null && votingNum != null) {
      url.searchParams.set('g', formatVoteParam(sitting, votingNum))
    } else {
      url.searchParams.delete('g')
    }
    window.history.replaceState(null, '', url)
  }, [mode, sitting, votingNum, restored])

  const voteView: VoteView | null = useMemo(() => {
    if (mode !== 'votes' || !detail) return null
    return { votes: expandVotes(detail.votes), kind: detail.kind }
  }, [mode, detail])

  function selectSitting(num: number) {
    setSitting(num)
    setVotingNum(null)
    setDetail(null)
  }

  return (
    <div>
      {/* Przełącznik trybu */}
      <div className="mb-5 flex justify-center">
        <div
          className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 p-1 shadow-sm"
          role="group"
          aria-label="Tryb widoku sali"
        >
          <ModeButton active={mode === 'clubs'} onClick={() => setMode('clubs')}>
            Kluby
          </ModeButton>
          <ModeButton active={mode === 'votes'} onClick={() => setMode('votes')}>
            Jak głosowali?
          </ModeButton>
        </div>
      </div>

      {mode === 'votes' ? (
        <div className="mx-auto mb-6 max-w-3xl">
          {manifestFailed ? (
            <ErrorCard
              message="Nie udało się wczytać listy głosowań."
              onRetry={() => {
                setManifestFailed(false)
                fetchVotingsManifest(true).then((m) => {
                  if (m) setManifest(m)
                  else setManifestFailed(true)
                })
              }}
            />
          ) : !manifest ? (
            <div className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" aria-hidden="true" />
          ) : (
            <>
              {manifest.placeholder ? (
                <p className="mb-3 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-2 text-center text-xs leading-relaxed text-amber-900">
                  Tryb demonstracyjny — głosowania są przykładowe. Realne dane pojawiają się po
                  synchronizacji przy publikacji.
                </p>
              ) : null}
              <div className="grid gap-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                <label className="block">
                  <span className="sr-only">Posiedzenie</span>
                  <select
                    value={sitting ?? ''}
                    onChange={(e) => selectSitting(Number(e.target.value))}
                    className="w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2.5 text-sm font-medium text-ink shadow-sm outline-none focus:border-ink/30"
                  >
                    {manifest.sittings.map((s) => (
                      <option key={s.num} value={s.num}>
                        Posiedzenie {s.num} · {formatRange(s.firstDate, s.lastDate)} · {s.votings} głosowań
                      </option>
                    ))}
                  </select>
                </label>
                <VotingPicker
                  votings={index?.votings ?? []}
                  selected={votingNum}
                  onSelect={setVotingNum}
                  loading={indexLoading}
                />
              </div>

              {failed ? (
                <p className="mt-3 rounded-xl border border-black/10 bg-white/70 px-4 py-2.5 text-center text-xs text-ink-muted">
                  Nie udało się pobrać danych głosowania — spróbuj ponownie za chwilę.
                </p>
              ) : null}

              {detail ? (
                <VotingSummaryCard detail={detail} />
              ) : !failed ? (
                <p className="mt-3 text-center text-xs text-ink-muted">
                  {detailLoading
                    ? 'Wczytywanie głosowania…'
                    : 'Wybierz głosowanie, aby pokolorować salę głosami posłów.'}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <ParliamentMap {...props} voteView={voteView} />
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-center">
      <p className="text-sm text-ink-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink-soft"
      >
        Spróbuj ponownie
      </button>
    </div>
  )
}

function ModeButton({
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
      className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        active ? 'bg-ink text-white shadow-sm' : 'text-ink-muted hover:bg-black/[0.05] hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function VotingSummaryCard({ detail }: { detail: VotingDetail }) {
  const isList = detail.kind === 'ON_LIST'
  const counts = [
    { label: VOTE_META.yes.label, value: detail.votes.y.length, color: VOTE_META.yes.color },
    { label: VOTE_META.no.label, value: detail.votes.n.length, color: VOTE_META.no.color },
    { label: VOTE_META.abstain.label, value: detail.votes.a.length, color: VOTE_META.abstain.color },
    { label: VOTE_META.absent.label, value: detail.votes.x.length, color: VOTE_META.absent.color },
  ]
  const passed = detail.votes.y.length > detail.votes.n.length

  return (
    <div className="mt-3 animate-fade-in rounded-2xl border border-black/5 bg-white/80 p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug text-ink">{detail.title}</h3>
          {detail.topic ? <p className="mt-0.5 text-xs text-ink-muted">{detail.topic}</p> : null}
        </div>
        <p className="flex-none text-xs text-ink-muted">{formatDateTime(detail.date)}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {isList ? (
          <span className="text-xs font-medium text-ink-muted">
            Głosowanie listowe — bez podziału za/przeciw · głos oddany:{' '}
            <span className="font-semibold text-ink">{detail.votes.v.length}</span> · nieobecni:{' '}
            <span className="font-semibold text-ink">{detail.votes.x.length}</span>
          </span>
        ) : (
          <>
            {counts.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}: <span className="font-semibold tabular-nums text-ink">{c.value}</span>
              </span>
            ))}
            <span
              className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {passed ? 'przyjęto' : 'odrzucono'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function formatRange(a: string, b: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }
  if (!a) return ''
  return a === b || !b ? fmt(a) : `${fmt(a)}–${fmt(b)}`
}

function formatDateTime(iso: string): string {
  if (!iso) return ''
  const [date, time] = iso.split('T')
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}${time ? ` ${time.slice(0, 5)}` : ''}`
}
