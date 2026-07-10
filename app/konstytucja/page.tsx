import type { Metadata } from 'next'
import { ChapterCard } from '@/components/konstytucja/ChapterCard'
import { KonstytucjaSearch } from '@/components/konstytucja/KonstytucjaSearch'
import { asset } from '@/lib/asset'
import { getKonstytucja } from '@/lib/konstytucja-data'

export const metadata: Metadata = {
  title: 'Konstytucja RP',
  description:
    'Pełny tekst Konstytucji Rzeczypospolitej Polskiej przedstawiony wizualnie — preambuła, 13 rozdziałów i 243 artykuły, z ikonami, streszczeniami i wyróżnieniem kluczowych artykułów.',
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  const miesiace = ['', 'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
  return `${Number(d)} ${miesiace[Number(m)]} ${y}`
}

export default function KonstytucjaPage() {
  const konst = getKonstytucja()
  if (!konst) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-ink-muted">
        Tekst Konstytucji nie został jeszcze wygenerowany.
      </div>
    )
  }

  const liczbaArt = konst.rozdzialy.reduce(
    (a, r) => a + r.elementy.filter((e) => e.artykul).length,
    0
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="mx-auto mb-10 max-w-2xl text-center">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
          Ustawa zasadnicza
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Konstytucja Rzeczypospolitej Polskiej
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Uchwalona {formatDate(konst.meta.uchwalona)}, weszła w życie{' '}
          {formatDate(konst.meta.weszla)}. {konst.meta.dziennik}.
        </p>
      </section>

      {/* Preambuła */}
      <section aria-labelledby="preambula" className="mb-12">
        <h2 id="preambula" className="mb-3 text-center font-display text-sm font-semibold uppercase tracking-widest text-ink-muted">
          Preambuła
        </h2>
        <blockquote className="relative rounded-3xl border border-black/5 bg-white/70 p-6 shadow-soft sm:p-9">
          <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1 font-display text-6xl text-ink/10 sm:text-7xl">
            „
          </span>
          <p className="text-pretty font-display text-base leading-relaxed text-ink sm:text-lg sm:leading-loose">
            {konst.preambula}
          </p>
        </blockquote>
      </section>

      {/* Statystyki */}
      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { v: '13', l: 'rozdziałów' },
          { v: String(liczbaArt), l: 'artykułów' },
          { v: '1997', l: 'rok uchwalenia' },
          { v: 'najwyższe', l: 'prawo w RP' },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-black/5 bg-white/60 p-4 text-center shadow-soft">
            <p className="font-display text-2xl font-bold text-ink">{s.v}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{s.l}</p>
          </div>
        ))}
      </section>

      {/* Wyszukiwarka */}
      <section aria-labelledby="szukaj" className="mb-12">
        <h2 id="szukaj" className="mb-3 font-display text-xl font-semibold tracking-tight text-ink">
          Szukaj w Konstytucji
        </h2>
        <KonstytucjaSearch />
      </section>

      {/* Rozdziały */}
      <section aria-labelledby="rozdzialy">
        <h2 id="rozdzialy" className="mb-4 font-display text-xl font-semibold tracking-tight text-ink">
          Rozdziały
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {konst.rozdzialy.map((r) => (
            <ChapterCard key={r.slug} nr={r.nr} slug={r.slug} od={r.od} do={r.do} />
          ))}
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-ink-muted">
        Tekst wierny z oficjalnego źródła.{' '}
        <a href={asset('/konstytucja.pdf')} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline decoration-dotted underline-offset-2 hover:text-ink-soft">
          Pobierz oficjalny PDF
        </a>
        .
      </p>
    </div>
  )
}
