'use client'

import { computeOutcome, OUTCOME_META, type VoteCode, type VotingDetail } from '@/lib/votings'
import { formatDateTime, formatRange, MajorityNote } from './VoteExplorer'
import { useVotingSelection } from './useVotingSelection'
import { VotingPicker } from './VotingPicker'
import { VotingTerminal, type TerminalState } from './VotingTerminal'

interface MPVoteCheckerProps {
  mpId: number
  mpName: string
}

/** Głos wskazanego posła w danym głosowaniu (+ opcja listowa, jeśli dotyczy). */
function resolveVote(detail: VotingDetail, mpId: number): { code: VoteCode; optionLabel?: string } {
  const g = detail.votes
  if (g.y.includes(mpId)) return { code: 'yes' }
  if (g.n.includes(mpId)) return { code: 'no' }
  if (g.a.includes(mpId)) return { code: 'abstain' }
  if (g.x.includes(mpId)) return { code: 'absent' }
  if (g.v.includes(mpId)) {
    if (g.l) {
      for (const [opt, ids] of Object.entries(g.l)) {
        if (ids.includes(mpId)) {
          return { code: 'valid', optionLabel: detail.options?.[Number(opt) - 1] }
        }
      }
    }
    return { code: 'valid' }
  }
  return { code: 'none' }
}

const BANNER: Record<VoteCode, string> = {
  yes: 'ZA',
  no: 'PRZECIW',
  abstain: 'WSTRZYMANO SIĘ',
  absent: 'NIEOBECNOŚĆ',
  valid: 'GŁOS ODDANY',
  none: 'POZA WYKAZEM',
}

/**
 * Sekcja profilu „Jak głosował(a)?": filtry posiedzenie → głosowanie
 * (współdzielony hook i picker ze strony głównej), a wynik pokazany na
 * sejmowej maszynce do głosowania (VotingTerminal).
 */
export function MPVoteChecker({ mpId, mpName }: MPVoteCheckerProps) {
  const sel = useVotingSelection(true)

  const vote = sel.detail ? resolveVote(sel.detail, mpId) : null
  const terminalState: TerminalState = vote ? vote.code : 'off'
  const bannerText = vote
    ? vote.code === 'valid' && vote.optionLabel
      ? vote.optionLabel
      : BANNER[vote.code]
    : 'WYBIERZ GŁOSOWANIE'
  const statusText = sel.detail
    ? `Głosowanie nr ${sel.detail.num} · ${formatDateTime(sel.detail.date).slice(-5)}`
    : undefined
  const ariaLabel = sel.detail
    ? `Głos posła ${mpName} w głosowaniu nr ${sel.detail.num}: ${bannerText}`
    : 'Terminal do głosowania — nie wybrano głosowania'

  return (
    <section className="mt-6 rounded-3xl border border-black/5 bg-white/70 p-6 shadow-soft backdrop-blur-sm sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Jak głosował(a)?
        </h2>
        {sel.manifest?.placeholder ? (
          <p className="text-xs text-ink-muted">dane demonstracyjne</p>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Wybierz posiedzenie i głosowanie — maszynka pokaże oddany głos.
      </p>

      {sel.manifestFailed ? (
        <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-5 text-center">
          <p className="text-sm text-ink-muted">Nie udało się wczytać listy głosowań.</p>
          <button
            type="button"
            onClick={sel.retryManifest}
            className="mt-3 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink-soft"
          >
            Spróbuj ponownie
          </button>
        </div>
      ) : !sel.manifest ? (
        <div className="mt-4 h-20 animate-pulse rounded-2xl bg-black/[0.05]" aria-hidden="true" />
      ) : (
        <>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
            <label className="block">
              <span className="sr-only">Posiedzenie</span>
              <select
                value={sel.sitting ?? ''}
                onChange={(e) => sel.selectSitting(Number(e.target.value))}
                className="w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2.5 text-sm font-medium text-ink shadow-sm outline-none focus:border-ink/30"
              >
                {sel.manifest.sittings.map((s) => (
                  <option key={s.num} value={s.num}>
                    Posiedzenie {s.num} · {formatRange(s.firstDate, s.lastDate)}
                  </option>
                ))}
              </select>
            </label>
            <VotingPicker
              votings={sel.index?.votings ?? []}
              selected={sel.votingNum}
              onSelect={sel.selectVoting}
              loading={sel.indexLoading}
            />
          </div>

          {sel.failed ? (
            <p className="mt-3 rounded-xl border border-black/10 bg-white/70 px-4 py-2.5 text-center text-xs text-ink-muted">
              Nie udało się pobrać danych głosowania — spróbuj ponownie za chwilę.
            </p>
          ) : null}

          <div className="mt-6">
            <VotingTerminal
              state={terminalState}
              bannerText={bannerText}
              statusText={statusText}
              ariaLabel={ariaLabel}
            />
          </div>

          {sel.detail ? (
            <div className="mx-auto mt-4 max-w-md text-center">
              <p className="text-sm font-medium leading-snug text-ink">{sel.detail.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {formatDateTime(sel.detail.date)}
                {vote?.code === 'none'
                  ? ' · poseł nie figurował wtedy na liście do głosowania'
                  : ''}
              </p>
              {(() => {
                const outcome = computeOutcome(sel.detail!)
                return outcome !== 'none' ? (
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${OUTCOME_META[outcome].tone}`}
                  >
                    Wynik: {OUTCOME_META[outcome].label}
                  </span>
                ) : null
              })()}
              <div className="mt-1 flex justify-center">
                <MajorityNote detail={sel.detail} />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-center text-xs text-ink-muted">
              {sel.detailLoading ? 'Wczytywanie głosowania…' : 'Terminal czeka na wybór głosowania.'}
            </p>
          )}
        </>
      )}
    </section>
  )
}
