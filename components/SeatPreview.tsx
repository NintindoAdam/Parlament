import Link from 'next/link'
import type { SeatDatum } from '@/lib/types'
import { VOTE_META, type VoteCode } from '@/lib/votings'
import { Photo } from './Photo'

interface SeatPreviewProps {
  seat: SeatDatum
  /** Pokaż przycisk przejścia do pełnego profilu (mobile / panel). */
  showButton?: boolean
  /** Głos posła w aktualnie wybranym głosowaniu (tryb „Jak głosowali?"). */
  vote?: VoteCode
}

export function SeatPreview({ seat, showButton = false, vote }: SeatPreviewProps) {
  return (
    <div className="flex items-start gap-3">
      <Photo
        id={seat.id}
        name={seat.name}
        hasPhoto={seat.hasPhoto}
        color={seat.color}
        className="h-16 w-16 flex-none rounded-xl shadow-sm ring-1 ring-black/10"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] font-semibold leading-tight text-ink">
          {seat.name}
        </p>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/[0.04] px-2 py-0.5 text-xs font-medium text-ink-soft">
            <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: seat.color }} />
            <span className="truncate">{seat.clubName}</span>
          </span>
          {vote ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2 py-0.5 text-xs font-semibold text-ink">
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ backgroundColor: VOTE_META[vote].color }}
              />
              {VOTE_META[vote].label}
            </span>
          ) : null}
        </span>
        <dl className="mt-1.5 space-y-0.5 text-xs text-ink-muted">
          {seat.district ? (
            <div className="truncate">
              <span className="text-ink-muted/70">Okręg: </span>
              <span className="text-ink-soft">
                {seat.district}
                {seat.districtNum ? ` (nr ${seat.districtNum})` : ''}
              </span>
            </div>
          ) : null}
          {seat.profession ? (
            <div className="truncate">
              <span className="text-ink-muted/70">Zawód: </span>
              <span className="text-ink-soft">{seat.profession}</span>
            </div>
          ) : null}
        </dl>
        {showButton ? (
          <Link
            href={`/posel/${seat.id}`}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink-soft"
          >
            Zobacz pełny profil
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : null}
      </div>
    </div>
  )
}
