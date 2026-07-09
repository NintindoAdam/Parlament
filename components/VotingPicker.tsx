'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { isQuorumVoting, matchesVoting, type VotingSummary } from '@/lib/votings'

interface VotingPickerProps {
  votings: VotingSummary[]
  selected: number | null
  onSelect: (num: number) => void
  loading?: boolean
}

/**
 * Wybór głosowania w ramach posiedzenia — combobox ARIA (wzorzec
 * LocalitySearch), ale filtrowanie czysto lokalne po tytule/temacie
 * (bez debounce). Opcje dwuwierszowe z mini-licznikami głosów.
 */
export function VotingPicker({ votings, selected, onSelect, loading = false }: VotingPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Obronnie odsiewamy głosowania kworum (na wypadek nieświeżego deployu danych).
  const cleaned = useMemo(() => votings.filter((v) => !isQuorumVoting(v)), [votings])
  const filtered = useMemo(() => cleaned.filter((v) => matchesVoting(v, query)), [cleaned, query])
  const selectedVoting = selected != null ? cleaned.find((v) => v.num === selected) : undefined

  useEffect(() => {
    setActive(0)
  }, [query, votings])

  // Zamknięcie listy po kliknięciu poza komponentem.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function select(v: VotingSummary) {
    setOpen(false)
    setQuery('')
    onSelect(v.num)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => (filtered.length ? (i + 1) % filtered.length : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(Math.max(0, filtered.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[active]) select(filtered[active])
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  const placeholder = loading
    ? 'Wczytywanie głosowań…'
    : selectedVoting
      ? `Głosowanie nr ${selectedVoting.num} · ${selectedVoting.title}`
      : 'Wybierz lub wyszukaj głosowanie…'

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && filtered[active] ? `${listId}-${filtered[active].num}` : undefined}
        aria-autocomplete="list"
        aria-label="Głosowanie"
        autoComplete="off"
        spellCheck={false}
        disabled={loading || votings.length === 0}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={`w-full truncate rounded-xl border border-black/10 bg-white/90 px-3.5 py-2.5 text-sm font-medium text-ink shadow-sm outline-none transition-shadow placeholder:font-normal focus:border-ink/30 focus:shadow-soft disabled:opacity-60 ${
          selectedVoting && !open ? 'placeholder:text-ink' : 'placeholder:text-ink-muted/70'
        }`}
      />

      <ul
        id={listId}
        role="listbox"
        aria-label="Głosowania na posiedzeniu"
        className={`absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-black/5 bg-white/95 p-1.5 shadow-card backdrop-blur-md ${
          open ? 'animate-pop-in' : 'hidden'
        }`}
      >
        {filtered.map((v, i) => (
          <li
            key={v.num}
            id={`${listId}-${v.num}`}
            role="option"
            aria-selected={v.num === selected}
            onPointerDown={(e) => {
              e.preventDefault()
              select(v)
            }}
            onMouseEnter={() => setActive(i)}
            className={`cursor-pointer rounded-xl px-3 py-2 transition-colors ${
              i === active ? 'bg-black/[0.06]' : ''
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-ink">
                {v.num}. {v.title}
              </span>
              {v.kind === 'ON_LIST' ? (
                <span className="flex-none rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  listowe
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 flex items-center justify-between gap-3 text-xs text-ink-muted">
              <span className="truncate">
                {v.topic || v.date.slice(11, 16)}
              </span>
              {v.kind !== 'ON_LIST' ? (
                <span className="flex flex-none items-center gap-1.5 tabular-nums text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#059669' }} />
                  {v.yes}
                  <span className="ml-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#e11d48' }} />
                  {v.no}
                  <span className="ml-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#d97706' }} />
                  {v.abstain}
                </span>
              ) : null}
            </span>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-sm text-ink-muted">
            Brak głosowań pasujących do „{query.trim()}”.
          </li>
        ) : null}
      </ul>
    </div>
  )
}
