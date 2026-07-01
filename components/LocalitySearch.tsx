'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  chunkKey,
  fetchChunk,
  placeContextLabel,
  rankSuggestions,
  type Place,
} from '@/lib/places'

interface LocalitySearchProps {
  onSelect: (place: Place) => void
  /** Początkowa treść pola (np. z parametru URL). */
  initialQuery?: string
  autoFocus?: boolean
}

/**
 * Pole wyszukiwania miejscowości — wzorzec ARIA combobox z listą podpowiedzi.
 * Podpowiedzi pobierane są z chunkowanego indeksu (public/places) po wpisaniu
 * co najmniej 2 znaków, z debounce 150 ms i pełną obsługą klawiatury.
 */
export function LocalitySearch({ onSelect, initialQuery = '', autoFocus = false }: LocalitySearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Pomija jedno przeszukanie, gdy query zmienia się wskutek wyboru podpowiedzi
  // (inaczej lista otwierałaby się ponownie nad wynikami).
  const skipSearchRef = useRef(false)
  const listId = useId()

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false
      return
    }
    const q = query.trim()
    if (q.length < 2) {
      setSuggestions([])
      setOpen(false)
      setSearched(false)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      const entries = await fetchChunk(chunkKey(q))
      if (cancelled) return
      const ranked = rankSuggestions(entries, q)
      setSuggestions(ranked)
      setActive(ranked.length > 0 ? 0 : -1)
      setOpen(true)
      setSearched(true)
      setLoading(false)
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  // Zamknięcie listy po kliknięciu poza komponentem.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function select(place: Place) {
    skipSearchRef.current = true
    setQuery(place.name)
    setSuggestions([])
    setOpen(false)
    onSelect(place)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Escape') setOpen(false)
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => (i + 1) % suggestions.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(suggestions.length - 1)
        break
      case 'Enter':
        e.preventDefault()
        if (active >= 0) select(suggestions[active])
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  const showEmpty = open && searched && !loading && suggestions.length === 0

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-muted" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-label="Nazwa miejscowości"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="np. Kęty, Nowa Wieś, Warszawa…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true)
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-2xl border border-black/10 bg-white/90 py-3.5 pl-11 pr-11 font-medium text-ink shadow-soft outline-none transition-shadow placeholder:font-normal placeholder:text-ink-muted/60 focus:border-ink/30 focus:shadow-card"
        />
        {loading ? (
          <span className="absolute inset-y-0 right-4 flex items-center" aria-hidden="true">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink/70" />
          </span>
        ) : null}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Podpowiedzi miejscowości"
        className={`absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-black/5 bg-white/95 p-1.5 shadow-card backdrop-blur-md ${
          open && (suggestions.length > 0 || showEmpty) ? 'animate-pop-in' : 'hidden'
        }`}
      >
        {suggestions.map((s, i) => (
          <li
            key={`${s.name}|${s.gmina}|${s.powiat}|${s.type}|${s.parent ?? ''}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onPointerDown={(e) => {
              e.preventDefault() // nie zabieraj fokusa z inputa
              select(s)
            }}
            onMouseEnter={() => setActive(i)}
            className={`cursor-pointer rounded-xl px-3 py-2 transition-colors ${
              i === active ? 'bg-black/[0.06]' : ''
            }`}
          >
            <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
            <span className="block truncate text-xs text-ink-muted">{placeContextLabel(s)}</span>
          </li>
        ))}
        {showEmpty ? (
          <li className="px-3 py-3 text-sm text-ink-muted">
            Nie znaleziono miejscowości „{query.trim()}”. Sprawdź pisownię lub wpisz nazwę gminy.
          </li>
        ) : null}
      </ul>
    </div>
  )
}
