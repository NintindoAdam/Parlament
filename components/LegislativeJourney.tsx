import { CANONICAL_ORDER, STAGE_META, type CanonicalStage } from '@/lib/legislation'

/**
 * „Podróż ustawy" — wizualna, kręta ścieżka od pomysłu do obowiązującego prawa.
 * Kamienie milowe (kanoniczne etapy) łączy gradientowy kręgosłup; na desktopie
 * karty układają się na przemian po obu stronach (zigzag), na mobile pionowo.
 * Treść statyczna i edukacyjna — reużywa STAGE_META (etykieta/kolor/wyjaśnienie).
 */

/** Minimalistyczne ikony liniowe per etap (biały stroke na kolorowym węźle). */
const ICONS: Record<CanonicalStage, React.ReactNode> = {
  inicjatywa: (
    <path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.6.6 1 1.3 1 2.5h6c0-1.2.4-1.9 1-2.5A6 6 0 0012 3z" />
  ),
  i_czytanie: (
    <path d="M12 3v4M8 7h8l-1.2 4.5a3 3 0 01-5.6 0L8 7zM12 11v6M8 21h8M10 17h4" />
  ),
  komisje: (
    <path d="M9 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM4 19a5 5 0 0110 0M16.5 12a2 2 0 100-4M15 19a5 5 0 015-4" />
  ),
  ii_czytanie: (
    <path d="M4 5h11a2 2 0 012 2v5a2 2 0 01-2 2H9l-4 3v-3H4a1 1 0 01-1-1V6a1 1 0 011-1zM8 8.5h6M8 11h4" />
  ),
  iii_czytanie_glosowanie: (
    <path d="M6 21h12M7 21V10l5-4 5 4v11M12 12l1.5 1.5L16 11" />
  ),
  senat: (
    <path d="M4 21h16M4 9h16M5 9l7-5 7 5M6 9v9M10 9v9M14 9v9M18 9v9" />
  ),
  sejm_wobec_senatu: (
    <path d="M4 9l3-3 3 3M7 6v7a2 2 0 002 2h7M20 15l-3 3-3-3M17 18v-7a2 2 0 00-2-2H8" />
  ),
  prezydent: (
    <path d="M4 20l1.5-4.5L15 6l3 3-9.5 9.5L4 20zM13 8l3 3M4 22h16" />
  ),
  publikacja: (
    <path d="M5 5a2 2 0 012-2h9a1 1 0 011 1v13H7a2 2 0 00-2 2V5zM17 17v3H7M9 7h6M9 10h6" />
  ),
}

function Node({ stage, step }: { stage: CanonicalStage; step: number }) {
  const m = STAGE_META[stage]
  return (
    <span className="relative z-10 grid place-items-center">
      <span
        className="grid h-12 w-12 place-items-center rounded-full text-white shadow-soft ring-4 ring-parchment"
        style={{ backgroundColor: m.color }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ICONS[stage]}
        </svg>
      </span>
      <span
        className="absolute -bottom-1.5 grid h-5 w-5 place-items-center rounded-full border-2 border-parchment bg-white text-[10px] font-bold tabular-nums text-ink shadow-sm"
        aria-hidden="true"
      >
        {step}
      </span>
    </span>
  )
}

function Card({ stage, side }: { stage: CanonicalStage; side: 'left' | 'right' }) {
  const m = STAGE_META[stage]
  return (
    <div
      className={`animate-fade-in rounded-2xl border border-black/5 bg-white/75 p-4 shadow-soft backdrop-blur-sm ${
        side === 'left' ? 'sm:text-right' : ''
      }`}
    >
      <div
        className={`mb-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white`}
        style={{ backgroundColor: m.color }}
      >
        {m.short}
      </div>
      <h3 className="font-display text-sm font-semibold text-ink">{m.label}</h3>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{m.explain}</p>
    </div>
  )
}

export function LegislativeJourney() {
  const last = CANONICAL_ORDER.length - 1
  return (
    <div className="mx-auto max-w-3xl">
      <Cap variant="start" />

      <ol className="relative">
        {CANONICAL_ORDER.map((stage, i) => {
          const left = i % 2 === 0
          const nextColor = i < last ? STAGE_META[CANONICAL_ORDER[i + 1]].color : STAGE_META[stage].color
          return (
            <li
              key={stage}
              className="grid grid-cols-[3rem_1fr] items-start gap-x-4 pb-8 last:pb-0 sm:grid-cols-[1fr_3rem_1fr] sm:gap-x-6"
            >
              {/* Kolumna węzła + gradientowy łącznik do następnego etapu */}
              <div className="relative col-start-1 flex h-full justify-center sm:col-start-2">
                {i < last ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-8 h-full w-1 -translate-x-1/2 rounded-full"
                    style={{ background: `linear-gradient(to bottom, ${STAGE_META[stage].color}, ${nextColor})`, opacity: 0.55 }}
                  />
                ) : null}
                <Node stage={stage} step={i + 1} />
              </div>

              {/* Karta: mobile zawsze po prawej; desktop na przemian lewo/prawo */}
              <div
                className={`col-start-2 ${
                  left ? 'sm:col-start-1 sm:flex sm:justify-end' : 'sm:col-start-3'
                }`}
              >
                <div className={left ? 'sm:max-w-sm' : 'sm:max-w-sm'}>
                  <Card stage={stage} side={left ? 'left' : 'right'} />
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <Cap variant="end" />
    </div>
  )
}

function Cap({ variant }: { variant: 'start' | 'end' }) {
  const isStart = variant === 'start'
  return (
    <div className={`flex ${isStart ? 'mb-2' : 'mt-2'} justify-center sm:justify-center`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-1.5 shadow-sm">
        <span
          className="grid h-6 w-6 place-items-center rounded-full text-white"
          style={{ backgroundColor: isStart ? '#7c5cdb' : '#334155' }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isStart ? <path d="M12 3v6M12 3l-2 2M12 3l2 2M5 13a7 7 0 0014 0" /> : <path d="M20 6L9 17l-5-5" />}
          </svg>
        </span>
        <span className="text-xs font-semibold text-ink">
          {isStart ? 'Start — pomysł na zmianę prawa' : 'Meta — ustawa wchodzi w życie'}
        </span>
      </div>
    </div>
  )
}
