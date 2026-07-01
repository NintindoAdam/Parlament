import Link from 'next/link'
import { getClubMeta } from '@/lib/clubs'
import type { MiniMP } from '@/lib/types'
import { Photo } from './Photo'

/**
 * Zwięzła karta posła do siatek wyników (wyszukiwarka, strona okręgu).
 * Komponent współdzielony — działa w drzewie serwerowym i klienckim.
 */
export function MPCard({ mp }: { mp: MiniMP }) {
  const club = getClubMeta(mp.club)
  return (
    <Link
      href={`/posel/${mp.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-black/5 bg-white/80 p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
    >
      <Photo
        id={mp.id}
        name={mp.name}
        hasPhoto={mp.hasPhoto}
        color={club.color}
        className="h-12 w-12 flex-none rounded-xl ring-1 ring-black/10"
      />
      <span className="min-w-0">
        <span className="block truncate font-display text-[15px] font-semibold leading-tight text-ink group-hover:underline group-hover:decoration-black/20 group-hover:underline-offset-2">
          {mp.name}
        </span>
        <span className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-medium text-ink-soft">
          <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ backgroundColor: club.color }} />
          <span className="truncate">{club.name}</span>
        </span>
      </span>
    </Link>
  )
}
