'use client'

import type { ClubCount } from '@/lib/types'

interface ClubLegendProps {
  clubs: ClubCount[]
  total: number
  active: string | null
  onActivate: (code: string | null) => void
}

export function ClubLegend({ clubs, total, active, onActivate }: ClubLegendProps) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-soft backdrop-blur-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold tracking-tight text-ink">Kluby i koła</h2>
        <span className="text-xs font-medium text-ink-muted">{total} mandatów</span>
      </div>
      <ul className="flex flex-wrap gap-1.5 lg:grid lg:grid-cols-1 lg:gap-1">
        {clubs.map((club) => {
          const isActive = active === club.code
          const dimmed = active !== null && !isActive
          return (
            <li key={club.code} className="flex-none lg:flex-auto">
              <button
                type="button"
                onMouseEnter={() => onActivate(club.code)}
                onMouseLeave={() => onActivate(null)}
                onFocus={() => onActivate(club.code)}
                onBlur={() => onActivate(null)}
                onClick={() => onActivate(isActive ? null : club.code)}
                aria-pressed={isActive}
                className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-left transition-all lg:whitespace-normal ${
                  isActive ? 'bg-black/[0.06]' : 'hover:bg-black/[0.03]'
                } ${dimmed ? 'opacity-45' : 'opacity-100'}`}
              >
                <span
                  className="h-3.5 w-3.5 flex-none rounded-[5px] ring-1 ring-black/10"
                  style={{ backgroundColor: club.color }}
                />
                <span className="flex-1 text-xs font-medium leading-tight text-ink-soft">
                  {club.name}
                </span>
                <span className="font-display text-sm font-semibold tabular-nums text-ink">
                  {club.count}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
