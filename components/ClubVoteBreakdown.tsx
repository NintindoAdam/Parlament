'use client'

import { useMemo } from 'react'
import { clubOrder } from '@/lib/clubs'
import type { SeatDatum } from '@/lib/types'
import { VOTE_META, voteLabel, type VoteCode } from '@/lib/votings'

interface ClubVoteBreakdownProps {
  seats: SeatDatum[]
  votes: Record<number, VoteCode>
  labels?: Partial<Record<VoteCode, string>>
  active: string | null
  onActivate: (key: string | null) => void
}

interface ClubRow {
  club: string
  clubName: string
  color: string
  total: number
  counts: Partial<Record<VoteCode, number>>
  dominant: { code: VoteCode; share: number }
}

const SEGMENT_ORDER = (Object.keys(VOTE_META) as VoteCode[]).sort(
  (a, b) => VOTE_META[a].order - VOTE_META[b].order
)

/** Zwięzłe kody klubów do wąskiej kolumny (pełna nazwa w title/aria-label). */
const SHORT_CLUB: Record<string, string> = {
  'Polska2050-TD': 'P2050',
  'PSL-TD': 'PSL-TD',
  Konfederacja: 'Konf.',
  KonfederacjaKP: 'KonfKP',
  Demokracja: 'Demokr.',
}

/**
 * Rozbicie wybranego głosowania per klub/koło: mini-pasek rozkładu głosów
 * i dominujący wynik (np. „98% za"). Hover/klik wiersza wygasza na mapie
 * fotele spoza klubu (klucz grupy z prefiksem `club:`).
 */
export function ClubVoteBreakdown({ seats, votes, labels, active, onActivate }: ClubVoteBreakdownProps) {
  const rows = useMemo<ClubRow[]>(() => {
    const byClub = new Map<string, ClubRow>()
    for (const s of seats) {
      let row = byClub.get(s.club)
      if (!row) {
        row = {
          club: s.club,
          clubName: s.clubName,
          color: s.color,
          total: 0,
          counts: {},
          dominant: { code: 'none', share: 0 },
        }
        byClub.set(s.club, row)
      }
      const code = votes[s.id] ?? 'none'
      row.total++
      row.counts[code] = (row.counts[code] ?? 0) + 1
    }
    const list = [...byClub.values()]
    for (const row of list) {
      let best: VoteCode = 'none'
      let bestCount = -1
      for (const code of SEGMENT_ORDER) {
        const c = row.counts[code] ?? 0
        if (c > bestCount) {
          best = code
          bestCount = c
        }
      }
      row.dominant = { code: best, share: row.total ? (bestCount / row.total) * 100 : 0 }
    }
    return list.sort((a, b) => clubOrder(a.club) - clubOrder(b.club))
  }, [seats, votes])

  return (
    <div className="mt-3 rounded-2xl border border-black/5 bg-white/70 p-4 shadow-soft backdrop-blur-sm">
      <h2 className="mb-3 font-display text-sm font-semibold tracking-tight text-ink">
        Kluby w tym głosowaniu
      </h2>
      <ul className="space-y-0.5">
        {rows.map((row) => {
          const key = `club:${row.club}`
          const isActive = active === key
          const dimmed = active !== null && !isActive
          return (
            <li key={row.club}>
              <button
                type="button"
                onMouseEnter={() => onActivate(key)}
                onMouseLeave={() => onActivate(null)}
                onFocus={() => onActivate(key)}
                onBlur={() => onActivate(null)}
                onClick={() => onActivate(isActive ? null : key)}
                aria-pressed={isActive}
                aria-label={`${row.clubName}: ${SEGMENT_ORDER.filter((c) => row.counts[c])
                  .map((c) => `${voteLabel(c, labels)} ${row.counts[c]}`)
                  .join(', ')}`}
                className={`grid w-full grid-cols-[4.4rem_1fr_5.1rem] items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-all ${
                  isActive ? 'bg-black/[0.06]' : 'hover:bg-black/[0.03]'
                } ${dimmed ? 'opacity-45' : 'opacity-100'}`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 flex-none rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="truncate text-[11px] font-semibold text-ink-soft" title={row.clubName}>
                    {SHORT_CLUB[row.club] ?? row.club}
                  </span>
                </span>
                {/* Mini-pasek rozkładu: odstępy 2px w kolorze tła karty. */}
                <span className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
                  {SEGMENT_ORDER.map((code) => {
                    const count = row.counts[code] ?? 0
                    if (count === 0) return null
                    return (
                      <span
                        key={code}
                        className="h-full min-w-[3px] first:rounded-l-full last:rounded-r-full"
                        style={{
                          backgroundColor: VOTE_META[code].color,
                          flexGrow: count,
                          flexBasis: 0,
                        }}
                      />
                    )
                  })}
                </span>
                <span className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-ink-muted">
                  <span className="font-semibold text-ink">{Math.round(row.dominant.share)}%</span>{' '}
                  {shortLabel(voteLabel(row.dominant.code, labels))}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Skraca etykietę do formy zdatnej na wąską kolumnę („Wstrzymał(a) się" → „wstrz."). */
function shortLabel(label: string): string {
  const map: Record<string, string> = {
    Za: 'za',
    Przeciw: 'przeciw',
    'Wstrzymał(a) się': 'wstrz.',
    Nieobecność: 'nieob.',
    'Głos oddany': 'oddany',
    'Poza wykazem': 'poza wyk.',
    'Poparł(a)': 'poparło',
    'Inny wybór': 'inny',
  }
  return map[label] ?? label.toLowerCase()
}
