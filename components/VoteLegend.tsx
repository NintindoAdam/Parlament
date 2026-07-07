'use client'

import { countVotes, VOTE_META, type VoteCode } from '@/lib/votings'

interface VoteLegendProps {
  votes: Record<number, VoteCode>
  active: string | null
  onActivate: (code: string | null) => void
}

/**
 * Legenda trybu „Jak głosowali?" — wizualny i interakcyjny odpowiednik
 * ClubLegend (hover/fokus/klik wygasza pozostałe kategorie na mapie).
 */
export function VoteLegend({ votes, active, onActivate }: VoteLegendProps) {
  const counts = countVotes(votes)
  const rows = (Object.keys(VOTE_META) as VoteCode[])
    .filter((code) => (counts[code] ?? 0) > 0)
    .sort((a, b) => VOTE_META[a].order - VOTE_META[b].order)
  const total = rows.reduce((a, code) => a + (counts[code] ?? 0), 0)

  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-soft backdrop-blur-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold tracking-tight text-ink">Głosy</h2>
        <span className="text-xs font-medium text-ink-muted">{total} posłów</span>
      </div>
      <ul className="flex gap-1.5 flex-wrap lg:grid lg:grid-cols-1 lg:gap-1">
        {rows.map((code) => {
          const meta = VOTE_META[code]
          const isActive = active === code
          const dimmed = active !== null && !isActive
          return (
            <li key={code} className="flex-none lg:flex-auto">
              <button
                type="button"
                onMouseEnter={() => onActivate(code)}
                onMouseLeave={() => onActivate(null)}
                onFocus={() => onActivate(code)}
                onBlur={() => onActivate(null)}
                onClick={() => onActivate(isActive ? null : code)}
                aria-pressed={isActive}
                className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-left transition-all lg:whitespace-normal ${
                  isActive ? 'bg-black/[0.06]' : 'hover:bg-black/[0.03]'
                } ${dimmed ? 'opacity-45' : 'opacity-100'}`}
              >
                <span
                  className="h-3.5 w-3.5 flex-none rounded-[5px] ring-1 ring-black/10"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="flex-1 text-xs font-medium leading-tight text-ink-soft">
                  {meta.label}
                </span>
                <span className="font-display text-sm font-semibold tabular-nums text-ink">
                  {counts[code]}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
