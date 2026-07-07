'use client'

import type { VoteCode } from '@/lib/votings'

export type TerminalState = VoteCode | 'off'

interface VotingTerminalProps {
  state: TerminalState
  /** Tekst banera na ekranie (np. „ZA", „WSTRZYMANO SIĘ", nazwisko kandydata). */
  bannerText: string
  /** Drobny tekst paska statusu (np. „GŁOSOWANIE NR 12 · 11:30"). */
  statusText?: string
  ariaLabel: string
}

/** Kolory ekranu terminala per stan (baner / tło ekranu / poświata). */
const SCREEN: Record<TerminalState, { banner: string; screen: string; glow: string; text: string }> = {
  yes: { banner: '#059669', screen: '#052e21', glow: 'rgba(5,150,105,0.45)', text: '#ffffff' },
  no: { banner: '#be123c', screen: '#e11d48', glow: 'rgba(225,29,72,0.5)', text: '#ffffff' },
  abstain: { banner: '#d97706', screen: '#2d1a03', glow: 'rgba(217,119,6,0.45)', text: '#ffffff' },
  valid: { banner: '#7c5cdb', screen: '#1e1440', glow: 'rgba(124,92,219,0.45)', text: '#ffffff' },
  absent: { banner: '#334155', screen: '#0b1220', glow: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
  none: { banner: '#1e293b', screen: '#0b1220', glow: 'rgba(148,163,184,0.1)', text: '#64748b' },
  off: { banner: '#1e293b', screen: '#0b1220', glow: 'rgba(148,163,184,0.08)', text: '#475569' },
}

/** Który fizyczny przycisk jest „wciśnięty" dla danego stanu. */
const PRESSED: Partial<Record<TerminalState, 0 | 1 | 2>> = { yes: 0, no: 1, abstain: 2 }

/**
 * Sejmowa maszynka do głosowania — skeuomorficzna wizualizacja głosu posła.
 * Mikrofon na gęsiej szyi, ekran z banerem w kolorze głosu (PRZECIW barwi
 * całe tło ekranu), rząd trzech fizycznych przycisków (wciśnięty ten
 * odpowiadający głosowi) i karta poselska w slocie (nieobecność = brak karty).
 */
export function VotingTerminal({ state, bannerText, statusText, ariaLabel }: VotingTerminalProps) {
  const palette = SCREEN[state]
  const pressed = PRESSED[state]
  const cardInserted = state === 'yes' || state === 'no' || state === 'abstain' || state === 'valid'
  const screenOn = state !== 'off' && state !== 'none'

  return (
    <div role="img" aria-label={ariaLabel} className="relative mx-auto w-full max-w-sm select-none px-6 pt-10">
      {/* Mikrofon na gęsiej szyi */}
      <svg
        viewBox="0 0 120 150"
        className="pointer-events-none absolute -top-1 left-0 h-36 w-auto"
        aria-hidden="true"
      >
        <path
          d="M78 148 C 60 120, 28 118, 22 78 C 19 56, 30 40, 44 34"
          fill="none"
          stroke="#1f2937"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M78 148 C 60 120, 28 118, 22 78 C 19 56, 30 40, 44 34"
          fill="none"
          stroke="#4b5563"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1.5 4"
        />
        <circle cx="50" cy="30" r="15" fill="#111827" />
        <circle cx="50" cy="30" r="15" fill="url(#micShine)" />
        <circle cx="46" cy="25" r="5" fill="rgba(255,255,255,0.14)" />
        <defs>
          <radialGradient id="micShine" cx="0.35" cy="0.3" r="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
          </radialGradient>
        </defs>
      </svg>

      {/* Karta poselska w slocie (prawa krawędź) */}
      <div className="absolute right-0 top-16 z-0" aria-hidden="true">
        {cardInserted ? (
          <div className="h-24 w-14 translate-x-6 rotate-[8deg] overflow-hidden rounded-lg bg-white shadow-card ring-1 ring-black/20">
            <div className="h-1/2 w-full bg-white" />
            <div className="h-1/2 w-full bg-[#dc2626]" />
            <div className="absolute inset-x-2 top-2 h-1.5 rounded-full bg-black/10" />
          </div>
        ) : (
          <div className="h-24 w-3 translate-x-2 rounded-l-md bg-black/15" />
        )}
      </div>

      {/* Korpus terminala */}
      <div className="relative z-10 rounded-[1.6rem] bg-gradient-to-b from-slate-600 via-slate-700 to-slate-900 p-3 shadow-card ring-1 ring-black/50">
        <div className="rounded-[1.15rem] bg-gradient-to-b from-slate-800 to-slate-950 p-2.5 ring-1 ring-white/5">
          {/* Ekran */}
          <div
            className="overflow-hidden rounded-lg ring-1 ring-white/10 transition-colors duration-300"
            style={{
              backgroundColor: palette.screen,
              boxShadow: screenOn ? `inset 0 0 40px ${palette.glow}, inset 0 2px 6px rgba(0,0,0,0.6)` : 'inset 0 2px 6px rgba(0,0,0,0.6)',
            }}
          >
            {/* Pasek statusu */}
            <div className="flex items-center justify-between px-3 pt-2 text-[9px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: screenOn ? 'rgba(255,255,255,0.55)' : '#334155' }}
            >
              <span>Sejm RP</span>
              <span className="tabular-nums">{statusText ?? '—'}</span>
            </div>

            {/* Baner głosu */}
            <div className="px-3 pb-2.5 pt-2">
              <div
                key={`${state}-${bannerText}`}
                className="animate-pop-in rounded-md px-3 py-3 text-center transition-colors duration-300"
                style={{
                  backgroundColor: screenOn ? palette.banner : 'rgba(30,41,59,0.6)',
                  boxShadow: screenOn ? `0 0 18px ${palette.glow}` : undefined,
                }}
              >
                <p
                  className="text-[10px] font-medium uppercase tracking-[0.22em]"
                  style={{ color: screenOn ? 'rgba(255,255,255,0.75)' : '#475569' }}
                >
                  Głos
                </p>
                <p
                  className="mt-0.5 break-words font-sans text-xl font-bold uppercase leading-tight tracking-wide"
                  style={{ color: palette.text }}
                >
                  {bannerText}
                </p>
              </div>

              {/* Rząd fizycznych przycisków */}
              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Za', color: '#059669' },
                  { label: 'Przeciw', color: '#e11d48' },
                  { label: 'Wstrzymuję się', color: '#d97706' },
                ].map((btn, i) => {
                  const isPressed = pressed === i
                  return (
                    <div
                      key={btn.label}
                      className="rounded-[5px] px-1 py-1.5 text-center text-[8px] font-bold uppercase tracking-wide text-white/95 transition-all duration-300"
                      style={{
                        backgroundColor: btn.color,
                        opacity: isPressed ? 1 : 0.38,
                        transform: isPressed ? 'translateY(1px) scale(0.98)' : undefined,
                        boxShadow: isPressed
                          ? `0 0 0 1.5px rgba(255,255,255,0.85), 0 0 14px ${btn.color}`
                          : 'inset 0 -2px 3px rgba(0,0,0,0.3)',
                      }}
                    >
                      {btn.label}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Dolna listwa z „diodą" zasilania */}
        <div className="mt-2 flex items-center justify-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: screenOn ? '#34d399' : '#475569',
              boxShadow: screenOn ? '0 0 6px rgba(52,211,153,0.8)' : undefined,
            }}
          />
          <span className="text-[8px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            System do głosowania
          </span>
        </div>
      </div>

      {/* Cień podstawy */}
      <div className="mx-auto mt-2 h-3 w-3/4 rounded-[100%] bg-black/15 blur-md" aria-hidden="true" />
    </div>
  )
}
