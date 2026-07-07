'use client'

import { useMemo, useState } from 'react'
import type { ClubCount, SeatDatum } from '@/lib/types'
import {
  computeOutcome,
  expandListVotes,
  expandVotes,
  LIST_OPTION_LABELS,
  majorityLabel,
  OUTCOME_META,
  VOTE_META,
  type VotingDetail,
} from '@/lib/votings'
import { ParliamentMap, type VoteView } from './ParliamentMap'
import { useVotingSelection } from './useVotingSelection'
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
  const sel = useVotingSelection(mode === 'votes', () => setMode('votes'))

  const voteView: VoteView | null = useMemo(() => {
    if (mode !== 'votes' || !sel.detail) return null
    if (sel.hasOptions && sel.option != null) {
      return {
        votes: expandListVotes(sel.detail.votes, sel.option),
        kind: sel.detail.kind,
        labels: LIST_OPTION_LABELS,
      }
    }
    return { votes: expandVotes(sel.detail.votes), kind: sel.detail.kind }
  }, [mode, sel.detail, sel.hasOptions, sel.option])

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
          {sel.manifestFailed ? (
            <ErrorCard message="Nie udało się wczytać listy głosowań." onRetry={sel.retryManifest} />
          ) : !sel.manifest ? (
            <div className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" aria-hidden="true" />
          ) : (
            <>
              {sel.manifest.placeholder ? (
                <p className="mb-3 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-2 text-center text-xs leading-relaxed text-amber-900">
                  Tryb demonstracyjny — głosowania są przykładowe. Realne dane pojawiają się po
                  synchronizacji przy publikacji.
                </p>
              ) : null}
              <div className="grid gap-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                <label className="block">
                  <span className="sr-only">Posiedzenie</span>
                  <select
                    value={sel.sitting ?? ''}
                    onChange={(e) => sel.selectSitting(Number(e.target.value))}
                    className="w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2.5 text-sm font-medium text-ink shadow-sm outline-none focus:border-ink/30"
                  >
                    {sel.manifest.sittings.map((s) => (
                      <option key={s.num} value={s.num}>
                        Posiedzenie {s.num} · {formatRange(s.firstDate, s.lastDate)} · {s.votings} głosowań
                      </option>
                    ))}
                  </select>
                </label>
                <VotingPicker
                  votings={sel.index?.votings ?? []}
                  selected={sel.votingNum}
                  onSelect={sel.selectVoting}
                  loading={sel.indexLoading}
                />
              </div>

              {sel.failed ? (
                <p className="mt-3 rounded-xl border border-black/10 bg-white/70 px-4 py-2.5 text-center text-xs text-ink-muted">
                  Nie udało się pobrać danych głosowania — spróbuj ponownie za chwilę.
                </p>
              ) : null}

              {sel.detail ? (
                <VotingSummaryCard detail={sel.detail} option={sel.option} onSelectOption={sel.setOption} />
              ) : !sel.failed ? (
                <p className="mt-3 text-center text-xs text-ink-muted">
                  {sel.detailLoading
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

function VotingSummaryCard({
  detail,
  option,
  onSelectOption,
}: {
  detail: VotingDetail
  option: string | null
  onSelectOption: (option: string) => void
}) {
  const isList = detail.kind === 'ON_LIST'
  const hasOptions = !!(detail.options?.length && detail.votes.l && Object.keys(detail.votes.l).length > 0)
  const counts = [
    { label: VOTE_META.yes.label, value: detail.votes.y.length, color: VOTE_META.yes.color },
    { label: VOTE_META.no.label, value: detail.votes.n.length, color: VOTE_META.no.color },
    { label: VOTE_META.abstain.label, value: detail.votes.a.length, color: VOTE_META.abstain.color },
    { label: VOTE_META.absent.label, value: detail.votes.x.length, color: VOTE_META.absent.color },
  ]
  const outcome = computeOutcome(detail)

  return (
    <div className="mt-3 animate-fade-in rounded-2xl border border-black/5 bg-white/80 p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug text-ink">{detail.title}</h3>
          {detail.topic && detail.topic !== detail.title ? (
            <p className="mt-0.5 text-xs text-ink-muted">{detail.topic}</p>
          ) : null}
        </div>
        <p className="flex-none text-xs text-ink-muted">{formatDateTime(detail.date)}</p>
      </div>

      {isList && hasOptions ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-muted">
            Głosowanie listowe — wybierz opcję, aby zobaczyć, kto ją poparł:
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Opcje głosowania">
            {detail.options!.map((label, i) => {
              const key = String(i + 1)
              const supporters = detail.votes.l?.[key]?.length ?? 0
              const isActive = option === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectOption(key)}
                  aria-pressed={isActive}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-ink bg-ink text-white'
                      : 'border-black/10 bg-white/80 text-ink-soft hover:bg-black/[0.04]'
                  }`}
                >
                  <span className="truncate">{label}</span>
                  <span className={`flex-none font-semibold tabular-nums ${isActive ? 'text-white/80' : 'text-ink'}`}>
                    {supporters}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Głos oddany: <span className="font-semibold text-ink">{detail.votes.v.length}</span> ·
            nieobecni: <span className="font-semibold text-ink">{detail.votes.x.length}</span>
          </p>
        </div>
      ) : (
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
              {outcome !== 'none' ? (
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${OUTCOME_META[outcome].tone}`}>
                  {OUTCOME_META[outcome].label}
                </span>
              ) : null}
            </>
          )}
        </div>
      )}

      {!isList ? <MajorityNote detail={detail} /> : null}
    </div>
  )
}

/** Drobny wiersz: rodzaj wymaganej większości + próg + liczba oddanych głosów. */
export function MajorityNote({ detail }: { detail: VotingDetail }) {
  const label = majorityLabel(detail.majorityType)
  if (!label && detail.majorityVotes == null && detail.totalVoted == null) return null
  const parts: string[] = []
  if (label) parts.push(label)
  if (typeof detail.majorityVotes === 'number' && detail.majorityVotes > 0)
    parts.push(`wymagane ${detail.majorityVotes} głosów`)
  if (typeof detail.totalVoted === 'number') parts.push(`oddano ${detail.totalVoted}`)
  if (parts.length === 0) return null
  return <p className="mt-2 text-[11px] text-ink-muted">{parts.join(' · ')}</p>
}

export function formatRange(a: string, b: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }
  if (!a) return ''
  return a === b || !b ? fmt(a) : `${fmt(a)}–${fmt(b)}`
}

export function formatDateTime(iso: string): string {
  if (!iso) return ''
  const [date, time] = iso.split('T')
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}${time ? ` ${time.slice(0, 5)}` : ''}`
}
