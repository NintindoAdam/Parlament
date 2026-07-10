'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Sala posiedzeń', match: (p: string) => p === '/' || p.startsWith('/posel') },
  {
    href: '/kto-mnie-reprezentuje',
    label: 'Kto mnie reprezentuje?',
    match: (p: string) => p.startsWith('/kto-mnie-reprezentuje') || p.startsWith('/okreg'),
  },
  {
    href: '/jak-powstaje-ustawa',
    label: 'Jak powstaje ustawa?',
    match: (p: string) => p.startsWith('/jak-powstaje-ustawa') || p.startsWith('/ustawa'),
  },
  {
    href: '/konstytucja',
    label: 'Konstytucja',
    match: (p: string) => p.startsWith('/konstytucja'),
  },
]

export function NavLinks() {
  // usePathname zwraca ścieżkę już bez basePath, więc porównania są proste.
  const pathname = usePathname() ?? '/'
  return (
    // Na wąskich ekranach pigułka nawigacji przewija się poziomo (ukryty pasek),
    // dzięki czemu 4 zakładki nie rozpychają strony.
    <div className="max-w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav
        aria-label="Główna nawigacja"
        className="flex w-max items-center gap-1 rounded-full border border-black/10 bg-white/70 p-1 shadow-sm"
      >
        {LINKS.map((link) => {
          const active = link.match(pathname)
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? 'bg-ink text-white shadow-sm' : 'text-ink-muted hover:bg-black/[0.05] hover:text-ink'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
