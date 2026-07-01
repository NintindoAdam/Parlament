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
]

export function NavLinks() {
  // usePathname zwraca ścieżkę już bez basePath, więc porównania są proste.
  const pathname = usePathname() ?? '/'
  return (
    <nav aria-label="Główna nawigacja" className="flex items-center gap-1 rounded-full border border-black/10 bg-white/70 p-1 shadow-sm">
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
  )
}
