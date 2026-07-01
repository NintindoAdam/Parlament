import Link from 'next/link'
import { getMeta } from '@/lib/data'
import { NavLinks } from './NavLinks'

export function Header() {
  const meta = getMeta()
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-parchment/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <Emblem />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-base font-semibold tracking-tight text-ink sm:text-lg">
              Sala Posiedzeń Sejmu
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
              Sejm RP · {romanTerm(meta.term)} kadencja
            </span>
          </span>
        </Link>
        {/* Na wąskich ekranach nawigacja przechodzi do drugiego wiersza. */}
        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
          <div className="flex justify-center sm:justify-end">
            <NavLinks />
          </div>
        </div>
        {meta.asOf ? (
          <span className="hidden rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-ink-muted shadow-sm lg:inline-block">
            stan na {meta.asOf}
          </span>
        ) : null}
      </div>
    </header>
  )
}

function Emblem() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-ink to-ink-soft text-white shadow-soft transition-transform group-hover:scale-105">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 20h16M5 20v-7m4 7v-7m6 7v-7m4 7v-7M3 11l9-6 9 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function romanTerm(n: number): string {
  const map: Record<number, string> = { 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII' }
  return map[n] ?? String(n)
}
