import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArticleView } from '@/components/konstytucja/ArticleView'
import { RozdzialIcon } from '@/components/konstytucja/RozdzialIcon'
import { ROZDZIAL_META } from '@/lib/konstytucja-meta'
import { getAllRozdzialy, getRozdzial } from '@/lib/konstytucja-data'

export function generateStaticParams() {
  return getAllRozdzialy().map((r) => ({ rozdzial: r.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rozdzial: string }>
}): Promise<Metadata> {
  const { rozdzial } = await params
  const r = getRozdzial(rozdzial)
  if (!r) return { title: 'Nie znaleziono rozdziału' }
  const m = ROZDZIAL_META[r.slug]
  return {
    title: `Rozdział ${r.nr}. ${m.nazwa} — Konstytucja RP`,
    description: m.summary,
  }
}

export default async function RozdzialPage({ params }: { params: Promise<{ rozdzial: string }> }) {
  const { rozdzial } = await params
  const r = getRozdzial(rozdzial)
  if (!r) notFound()
  const m = ROZDZIAL_META[r.slug]

  const all = getAllRozdzialy()
  const idx = all.findIndex((x) => x.slug === r.slug)
  const prev = idx > 0 ? all[idx - 1] : null
  const next = idx < all.length - 1 ? all[idx + 1] : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/konstytucja"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> Konstytucja RP
      </Link>

      <header className="mt-4 flex items-start gap-4">
        <span
          className="grid h-14 w-14 flex-none place-items-center rounded-2xl text-white shadow-soft"
          style={{ backgroundColor: m.color }}
        >
          <RozdzialIcon slug={r.slug} size={28} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-sm font-bold tracking-wide" style={{ color: m.color }}>
              Rozdział {r.nr}
            </span>
            <span className="text-xs text-ink-muted">{r.od === r.do ? `art. ${r.od}` : `art. ${r.od}–${r.do}`}</span>
          </div>
          <h1 className="mt-0.5 text-pretty font-display text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
            {m.nazwa}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{m.summary}</p>
        </div>
      </header>

      <div className="mt-6 rounded-3xl border border-black/5 bg-white/60 px-5 py-2 shadow-soft sm:px-8">
        {r.elementy.map((e, i) =>
          e.sekcja ? (
            <h2
              key={`s-${i}`}
              className="mt-6 border-t border-black/5 pt-5 font-display text-base font-semibold tracking-tight first:mt-2 first:border-t-0 first:pt-2"
              style={{ color: m.color }}
            >
              {e.sekcja}
            </h2>
          ) : e.artykul ? (
            <ArticleView key={`a-${e.artykul.nr}`} art={e.artykul} color={m.color} />
          ) : null
        )}
      </div>

      {/* Nawigacja rozdziałów */}
      <nav className="mt-8 flex items-stretch justify-between gap-3" aria-label="Nawigacja rozdziałów">
        {prev ? (
          <Link href={`/konstytucja/${prev.slug}`} className="flex-1 rounded-2xl border border-black/5 bg-white/70 p-3 text-left shadow-soft transition-shadow hover:shadow-card">
            <span className="text-[11px] text-ink-muted">← Rozdział {prev.nr}</span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{ROZDZIAL_META[prev.slug].nazwa}</span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {next ? (
          <Link href={`/konstytucja/${next.slug}`} className="flex-1 rounded-2xl border border-black/5 bg-white/70 p-3 text-right shadow-soft transition-shadow hover:shadow-card">
            <span className="text-[11px] text-ink-muted">Rozdział {next.nr} →</span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{ROZDZIAL_META[next.slug].nazwa}</span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </nav>
    </div>
  )
}
