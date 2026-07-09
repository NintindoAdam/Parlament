import Link from 'next/link'
import {
  CANONICAL_ORDER,
  formatDate,
  STAGE_META,
  voteHref,
  type ProcessRecord,
} from '@/lib/legislation'

/**
 * Pionowa oś procesu legislacyjnego. Renderuje wszystkie dziewięć kanonicznych
 * etapów; te osiągnięte pokazują datę, decyzję i wyjaśnienie, a etapy będące
 * głosowaniem — link do widoku „Jak głosowali?". Etapy jeszcze nieosiągnięte
 * są wyszarzone, dzięki czemu widać, ile drogi zostało.
 */
export function LegislativeTimeline({ record }: { record: ProcessRecord }) {
  const byStage = new Map(record.steps.map((s) => [s.stage, s]))
  const lastDone = record.steps[record.steps.length - 1]?.stage

  return (
    <ol className="relative">
      {CANONICAL_ORDER.map((stage, i) => {
        const step = byStage.get(stage)
        const meta = STAGE_META[stage]
        const done = !!step
        const current = stage === lastDone
        const isLast = i === CANONICAL_ORDER.length - 1

        return (
          <li key={stage} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Łącznik pionowy */}
            {!isLast ? (
              <span
                aria-hidden="true"
                className="absolute left-[11px] top-6 h-full w-0.5"
                style={{ backgroundColor: done ? meta.color : '#e2e8f0', opacity: done ? 0.35 : 1 }}
              />
            ) : null}

            {/* Węzeł */}
            <span
              aria-hidden="true"
              className={`relative z-10 mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full ring-4 ring-parchment ${
                current ? 'shadow-[0_0_0_3px_rgba(0,0,0,0.06)]' : ''
              }`}
              style={{ backgroundColor: done ? meta.color : '#e2e8f0' }}
            >
              {done ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
              )}
            </span>

            {/* Treść */}
            <div className={`min-w-0 flex-1 ${done ? '' : 'opacity-55'}`}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 className="font-display text-sm font-semibold text-ink">{meta.label}</h3>
                {step?.date ? (
                  <span className="text-xs tabular-nums text-ink-muted">{formatDate(step.date)}</span>
                ) : null}
                {current ? (
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    aktualny etap
                  </span>
                ) : null}
              </div>

              {step?.decision ? (
                <p className="mt-0.5 text-xs font-medium text-ink-soft">{step.decision}</p>
              ) : null}

              {done ? (
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{meta.explain}</p>
              ) : null}

              {step?.vote ? (
                <Link
                  href={voteHref(step.vote)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink-soft"
                >
                  Zobacz, jak głosowali
                  <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
