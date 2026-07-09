'use client'

import { useId, useState } from 'react'
import { lookupTerm } from '@/lib/glossary'

interface TermProps {
  /** Klucz w słowniczku (np. „większość bezwzględna"). */
  k: string
  /** Tekst do wyświetlenia (domyślnie: termin ze słowniczka). */
  children?: React.ReactNode
}

/**
 * Termin ze słowniczka — kropkowane podkreślenie + dymek z definicją.
 * Pokazuje się na hover i focus (klawiatura), znika po opuszczeniu/Escape.
 * Gdy klucza nie ma w słowniczku, renderuje zwykły tekst (bezpieczny fallback).
 */
export function Term({ k, children }: TermProps) {
  const entry = lookupTerm(k)
  const [open, setOpen] = useState(false)
  const id = useId()
  const label = children ?? entry?.term ?? k

  if (!entry) return <>{label}</>

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="cursor-help border-b border-dotted border-ink/40 font-medium text-ink decoration-dotted underline-offset-2 transition-colors hover:border-ink"
      >
        {label}
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="animate-fade-in absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-black/10 bg-white/95 p-3 text-left text-xs font-normal leading-relaxed text-ink-soft shadow-card backdrop-blur-md"
        >
          <span className="mb-0.5 block font-semibold text-ink">{entry.term}</span>
          {entry.definition}
        </span>
      ) : null}
    </span>
  )
}
