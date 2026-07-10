import Link from 'next/link'
import { ROZDZIAL_META } from '@/lib/konstytucja-meta'
import { RozdzialIcon } from './RozdzialIcon'

/** Kafelek rozdziału na stronie głównej Konstytucji. */
export function ChapterCard({
  nr,
  slug,
  od,
  do: doNr,
}: {
  nr: string
  slug: string
  od: number
  do: number
}) {
  const m = ROZDZIAL_META[slug]
  return (
    <Link
      href={`/konstytucja/${slug}`}
      className="group flex gap-3.5 rounded-2xl border border-black/5 bg-white/75 p-4 shadow-soft transition-shadow hover:shadow-card"
    >
      <span
        className="grid h-11 w-11 flex-none place-items-center rounded-xl text-white shadow-soft"
        style={{ backgroundColor: m.color }}
      >
        <RozdzialIcon slug={slug} />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xs font-bold tracking-wide" style={{ color: m.color }}>
            Rozdział {nr}
          </span>
          <span className="text-[11px] text-ink-muted">
            {od === doNr ? `art. ${od}` : `art. ${od}–${doNr}`}
          </span>
        </div>
        <h3 className="mt-0.5 font-display text-sm font-semibold leading-snug text-ink">{m.nazwa}</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{m.summary}</p>
      </div>
    </Link>
  )
}
