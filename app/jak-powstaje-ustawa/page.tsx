import type { Metadata } from 'next'
import { LegislationSearch } from '@/components/LegislationSearch'
import { Term } from '@/components/Term'
import { getMeta } from '@/lib/data'
import { CANONICAL_ORDER, STAGE_META } from '@/lib/legislation'

export const metadata: Metadata = {
  title: 'Jak powstaje ustawa?',
  description:
    'Prześledź drogę projektu ustawy w Sejmie — od inicjatywy, przez czytania i komisje, po Senat, Prezydenta i Dziennik Ustaw. Zobacz, jak głosowali posłowie na każdym etapie.',
}

export default function JakPowstajeUstawaPage() {
  const meta = getMeta()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="mx-auto mb-10 max-w-2xl text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Jak powstaje ustawa?
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-ink-muted sm:text-base">
          Zanim pomysł stanie się obowiązującym prawem, musi przejść długą drogę. Poznaj kolejne
          etapy — od <Term k="inicjatywa ustawodawcza">inicjatywy ustawodawczej</Term> po ogłoszenie
          w <Term k="dziennik ustaw">Dzienniku Ustaw</Term> — a potem prześledź prawdziwe projekty i
          zobacz, jak na każdym głosowaniu zachowali się posłowie.
        </p>
      </section>

      {/* Infografika: droga ustawy w 9 krokach */}
      <section aria-labelledby="droga-ustawy" className="mb-14">
        <h2 id="droga-ustawy" className="mb-5 text-center font-display text-xl font-semibold tracking-tight text-ink">
          Droga ustawy w 9 krokach
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {CANONICAL_ORDER.map((stage, i) => {
            const m = STAGE_META[stage]
            return (
              <li
                key={stage}
                className="flex gap-3 rounded-2xl border border-black/5 bg-white/70 p-4 shadow-soft"
              >
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 flex-none place-items-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: m.color }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-semibold text-ink">{m.label}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{m.explain}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Prawdziwe projekty */}
      <section aria-labelledby="projekty">
        <h2 id="projekty" className="mb-2 text-center font-display text-xl font-semibold tracking-tight text-ink">
          Prześledź prawdziwe projekty ustaw
        </h2>
        <p className="mx-auto mb-5 max-w-xl text-center text-sm leading-relaxed text-ink-muted">
          Wybierz projekt, aby zobaczyć jego oś czasu i to, jak posłowie głosowali na kolejnych
          etapach.
        </p>

        {meta.placeholder ? (
          <p className="mx-auto mb-5 max-w-xl rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-2.5 text-center text-xs leading-relaxed text-amber-900">
            Tryb demonstracyjny: projekty są przykładowe. Prawdziwe procesy legislacyjne pojawiają
            się po synchronizacji z API Sejmu przy publikacji.
          </p>
        ) : null}

        <LegislationSearch />
      </section>
    </div>
  )
}
