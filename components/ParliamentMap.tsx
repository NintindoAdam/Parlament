'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClubCount, SeatDatum } from '@/lib/types'
import { VOTE_META, voteLabel, type VoteCode } from '@/lib/votings'
import { ClubLegend } from './ClubLegend'
import { ClubVoteBreakdown } from './ClubVoteBreakdown'
import { SeatPreview } from './SeatPreview'
import { VoteLegend } from './VoteLegend'

/** Aktywny widok głosowania: mapa poseł → głos (tryb „Jak głosowali?"). */
export interface VoteView {
  votes: Record<number, VoteCode>
  kind: string
  /** Nadpisane etykiety kategorii (np. „Poparł(a)" dla opcji głosowania listowego). */
  labels?: Partial<Record<VoteCode, string>>
}

interface ParliamentMapProps {
  width: number
  height: number
  seatRadius: number
  hitRadius: number
  seats: SeatDatum[]
  clubs: ClubCount[]
  /** Gdy ustawione, fotele kolorowane są głosami zamiast barw klubów. */
  voteView?: VoteView | null
}

export function ParliamentMap({
  width,
  height,
  seatRadius,
  hitRadius,
  seats,
  clubs,
  voteView = null,
}: ParliamentMapProps) {
  const router = useRouter()
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [selected, setSelected] = useState<SeatDatum | null>(null)
  // Klucz grupy do wygaszania: kod klubu (tryb klubów) lub kod głosu (tryb głosowań).
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [coarse, setCoarse] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)')
    const update = () => setCoarse(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Zmiana widoku (kluby ↔ głosowanie, inne głosowanie) czyści wygaszenie.
  useEffect(() => {
    setActiveGroup(null)
  }, [voteView])

  const byId = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats])
  const hovered = hoveredId !== null ? byId.get(hoveredId) ?? null : null

  const voteOf = (id: number): VoteCode => voteView?.votes[id] ?? 'none'
  const groupOf = (s: SeatDatum): string => (voteView ? voteOf(s.id) : s.club)
  const fillOf = (s: SeatDatum): string => (voteView ? VOTE_META[voteOf(s.id)].color : s.color)
  // Klucze z prefiksem `club:` (rozbicie per klub w trybie głosowań) wygaszają
  // po klubie; pozostałe — po grupie (kod głosu lub klub, zależnie od trybu).
  const matchesGroup = (s: SeatDatum, group: string): boolean =>
    group.startsWith('club:') ? s.club === group.slice(5) : groupOf(s) === group

  function activate(seat: SeatDatum) {
    if (coarse) {
      setSelected(seat)
    } else {
      router.push(`/posel/${seat.id}`)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_18rem] lg:items-start lg:gap-7">
      {/* Mapa */}
      <div ref={containerRef} className="relative" onMouseLeave={() => setHoveredId(null)}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full select-none overflow-visible"
          role="group"
          aria-label="Mapa miejsc w sali posiedzeń Sejmu"
        >
          <Rostrum cx={width / 2} cy={height - 28} />
          {seats.map((s) => {
            const isHovered = hoveredId === s.id
            const isDimmed = activeGroup !== null && !matchesGroup(s, activeGroup)
            const r = isHovered ? seatRadius * 1.5 : seatRadius
            const ariaVote = voteView ? `, głos: ${voteLabel(voteOf(s.id), voteView.labels)}` : ''
            return (
              <g key={s.id}>
                {/* Widoczny kwadracik (mniejszy, z luką) — bez obsługi zdarzeń. */}
                <rect
                  x={s.x - r}
                  y={s.y - r}
                  width={r * 2}
                  height={r * 2}
                  rx={r * 0.34}
                  fill={fillOf(s)}
                  className="pointer-events-none transition-all duration-150"
                  style={{
                    opacity: isDimmed ? 0.2 : 1,
                    stroke: isHovered ? '#0f172a' : 'rgba(15,23,42,0.16)',
                    strokeWidth: isHovered ? 1.6 : 0.5,
                    filter: isHovered ? 'drop-shadow(0 2px 7px rgba(15,23,42,0.4))' : undefined,
                  }}
                />
                {/* Niewidzialny, większy obszar najazdu/kliknięcia (cała komórka). */}
                <rect
                  x={s.x - hitRadius}
                  y={s.y - hitRadius}
                  width={hitRadius * 2}
                  height={hitRadius * 2}
                  fill="transparent"
                  tabIndex={0}
                  role="link"
                  aria-label={`${s.name}, ${s.clubName}${ariaVote}`}
                  onMouseEnter={() => setHoveredId(s.id)}
                  onFocus={() => setHoveredId(s.id)}
                  onClick={() => activate(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      activate(s)
                    }
                  }}
                  className="cursor-pointer outline-none focus-visible:ring"
                />
              </g>
            )
          })}
        </svg>

        {/* Hover-card (desktop) */}
        {!coarse && hovered ? (
          <SeatTooltip
            seat={hovered}
            width={width}
            height={height}
            vote={voteView ? voteOf(hovered.id) : undefined}
            voteLabels={voteView?.labels}
          />
        ) : null}
      </div>

      {/* Legenda */}
      <div className="lg:sticky lg:top-20">
        {voteView ? (
          <>
            <VoteLegend
              votes={expandForLegend(voteView, seats)}
              labels={voteView.labels}
              active={activeGroup}
              onActivate={setActiveGroup}
            />
            <ClubVoteBreakdown
              seats={seats}
              votes={voteView.votes}
              labels={voteView.labels}
              active={activeGroup}
              onActivate={setActiveGroup}
            />
          </>
        ) : (
          <ClubLegend clubs={clubs} total={seats.length} active={activeGroup} onActivate={setActiveGroup} />
        )}
        <p className="mt-3 px-1 text-xs leading-relaxed text-ink-muted">
          {coarse
            ? 'Dotknij miejsca, aby zobaczyć posła.'
            : 'Najedź na miejsce, aby zobaczyć posła. Kliknij, by otworzyć pełny profil.'}
        </p>
      </div>

      {/* Panel dolny (mobile / dotyk) */}
      {coarse && selected ? (
        <MobileSheet
          seat={selected}
          vote={voteView ? voteOf(selected.id) : undefined}
          voteLabels={voteView?.labels}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  )
}

/**
 * Głosy do legendy liczone po miejscach na sali (obecny skład) — posłowie
 * spoza ówczesnego wykazu trafiają do kategorii „Poza wykazem".
 */
function expandForLegend(voteView: VoteView, seats: SeatDatum[]): Record<number, VoteCode> {
  const out: Record<number, VoteCode> = {}
  for (const s of seats) out[s.id] = voteView.votes[s.id] ?? 'none'
  return out
}

function SeatTooltip({
  seat,
  width,
  height,
  vote,
  voteLabels,
}: {
  seat: SeatDatum
  width: number
  height: number
  vote?: VoteCode
  voteLabels?: Partial<Record<VoteCode, string>>
}) {
  const leftPct = Math.min(86, Math.max(14, (seat.x / width) * 100))
  const topPct = (seat.y / height) * 100
  const below = topPct < 40
  return (
    <div
      className="pointer-events-none absolute z-30 w-64 animate-pop-in"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: below ? 'translate(-50%, 18px)' : 'translate(-50%, calc(-100% - 18px))',
      }}
    >
      <div className="rounded-2xl border border-black/5 bg-white/95 p-3 shadow-card backdrop-blur-md">
        <SeatPreview seat={seat} vote={vote} voteLabels={voteLabels} />
      </div>
    </div>
  )
}

function MobileSheet({
  seat,
  vote,
  voteLabels,
  onClose,
}: {
  seat: SeatDatum
  vote?: VoteCode
  voteLabels?: Partial<Record<VoteCode, string>>
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[2px] animate-fade-in"
      />
      <div className="absolute inset-x-0 bottom-0 animate-fade-in rounded-t-3xl border-t border-black/10 bg-white p-5 pb-7 shadow-card">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/15" />
        <SeatPreview seat={seat} showButton vote={vote} voteLabels={voteLabels} />
      </div>
    </div>
  )
}

/** Subtelna dekoracja w centrum hemicyklu — mównica / stół prezydialny. */
function Rostrum({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g opacity={0.5} aria-hidden="true">
      <path
        d={`M ${cx - 120} ${cy} A 120 120 0 0 1 ${cx + 120} ${cy}`}
        fill="none"
        stroke="rgba(15,23,42,0.14)"
        strokeWidth={1.2}
      />
      <rect x={cx - 26} y={cy - 16} width={52} height={20} rx={5} fill="rgba(15,23,42,0.10)" />
    </g>
  )
}
