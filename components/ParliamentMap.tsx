'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClubCount, SeatDatum } from '@/lib/types'
import { ClubLegend } from './ClubLegend'
import { SeatPreview } from './SeatPreview'

interface ParliamentMapProps {
  width: number
  height: number
  seatRadius: number
  seats: SeatDatum[]
  clubs: ClubCount[]
}

export function ParliamentMap({ width, height, seatRadius, seats, clubs }: ParliamentMapProps) {
  const router = useRouter()
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [selected, setSelected] = useState<SeatDatum | null>(null)
  const [activeClub, setActiveClub] = useState<string | null>(null)
  const [coarse, setCoarse] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)')
    const update = () => setCoarse(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Prefetch trasy profili dla płynnego przejścia po kliknięciu.
  const byId = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats])
  const hovered = hoveredId !== null ? byId.get(hoveredId) ?? null : null

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
      <div
        ref={containerRef}
        className="relative"
        onMouseLeave={() => setHoveredId(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full select-none overflow-visible"
          role="group"
          aria-label="Mapa miejsc w sali posiedzeń Sejmu"
        >
          <Rostrum cx={width / 2} cy={height - 28} />
          {seats.map((s) => {
            const isHovered = hoveredId === s.id
            const isDimmed = activeClub !== null && s.club !== activeClub
            const r = isHovered ? seatRadius * 1.55 : seatRadius
            return (
              <rect
                key={s.id}
                x={s.x - r}
                y={s.y - r}
                width={r * 2}
                height={r * 2}
                rx={r * 0.34}
                fill={s.color}
                tabIndex={0}
                role="link"
                aria-label={`${s.name}, ${s.clubName}`}
                onMouseEnter={() => setHoveredId(s.id)}
                onFocus={() => setHoveredId(s.id)}
                onClick={() => activate(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    activate(s)
                  }
                }}
                className="cursor-pointer outline-none transition-[opacity] duration-150 focus-visible:ring"
                style={{
                  opacity: isDimmed ? 0.22 : 1,
                  stroke: isHovered ? '#0f172a' : 'rgba(15,23,42,0.18)',
                  strokeWidth: isHovered ? 1.6 : 0.6,
                  filter: isHovered ? 'drop-shadow(0 2px 6px rgba(15,23,42,0.35))' : undefined,
                }}
              />
            )
          })}
        </svg>

        {/* Hover-card (desktop) */}
        {!coarse && hovered ? <SeatTooltip seat={hovered} width={width} height={height} /> : null}
      </div>

      {/* Legenda */}
      <div className="lg:sticky lg:top-20">
        <ClubLegend clubs={clubs} total={seats.length} active={activeClub} onActivate={setActiveClub} />
        <p className="mt-3 px-1 text-xs leading-relaxed text-ink-muted">
          {coarse ? 'Dotknij miejsca, aby zobaczyć posła.' : 'Najedź na miejsce, aby zobaczyć posła. Kliknij, by otworzyć pełny profil.'}
        </p>
      </div>

      {/* Panel dolny (mobile / dotyk) */}
      {coarse && selected ? (
        <MobileSheet seat={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  )
}

function SeatTooltip({ seat, width, height }: { seat: SeatDatum; width: number; height: number }) {
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
        <SeatPreview seat={seat} />
      </div>
    </div>
  )
}

function MobileSheet({ seat, onClose }: { seat: SeatDatum; onClose: () => void }) {
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
        <SeatPreview seat={seat} showButton />
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
