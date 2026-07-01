'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  chunkKey,
  fetchChunk,
  formatPlaceParam,
  matchesPlaceParam,
  parsePlaceParam,
  placeContextLabel,
  rankSuggestions,
  tupleToPlace,
  type Place,
} from '@/lib/places'
import type { MiniMP } from '@/lib/types'
import { LocalitySearch } from './LocalitySearch'
import { MPCard } from './MPCard'

interface RepresentationFinderProps {
  districts: Record<number, { name: string; voivodeship: string }>
  mpsByDistrict: Record<number, MiniMP[]>
}

/**
 * Wyszukiwarka „Kto mnie reprezentuje?": miejscowość → okręg → posłowie.
 * Wybór zapisuje się w URL (?m=nazwa|gmina|powiat), więc wynikiem można się
 * dzielić; przy wejściu z takim parametrem wybór odtwarza się automatycznie.
 */
export function RepresentationFinder({ districts, mpsByDistrict }: RepresentationFinderProps) {
  const [selected, setSelected] = useState<Place | null>(null)
  const [initialQuery, setInitialQuery] = useState('')
  const [restoring, setRestoring] = useState(true)

  // Odtworzenie wyboru z URL. Celowo window.location.search zamiast
  // useSearchParams — przy statycznym eksporcie unika pułapki Suspense.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('m')
    const param = raw ? parsePlaceParam(raw) : null
    if (!param) {
      setRestoring(false)
      return
    }
    let cancelled = false
    fetchChunk(chunkKey(param.name)).then((entries) => {
      if (cancelled) return
      const match = entries.map(tupleToPlace).find((p) => matchesPlaceParam(p, param))
      if (match) {
        setSelected(match)
      } else {
        setInitialQuery(param.name)
      }
      setRestoring(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function handleSelect(place: Place) {
    setSelected(place)
    const url = new URL(window.location.href)
    url.searchParams.set('m', formatPlaceParam(place))
    window.history.replaceState(null, '', url)
  }

  const district = selected ? districts[selected.okreg] : null
  const mps = selected ? mpsByDistrict[selected.okreg] ?? [] : []

  return (
    <div>
      <div className="mx-auto max-w-xl">
        {restoring ? (
          <div className="h-[54px] animate-pulse rounded-2xl bg-black/[0.05]" aria-hidden="true" />
        ) : (
          <LocalitySearch onSelect={handleSelect} initialQuery={initialQuery} autoFocus={!selected} />
        )}
      </div>

      {selected && district ? (
        <section className="mt-8 animate-fade-in" aria-live="polite">
          <div className="overflow-hidden rounded-3xl border border-black/5 bg-white/80 shadow-card backdrop-blur-sm">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
              <div className="flex h-20 w-20 flex-none flex-col items-center justify-center rounded-2xl bg-ink text-white shadow-soft">
                <span className="text-[10px] font-medium uppercase tracking-widest text-white/60">Okręg</span>
                <span className="font-display text-3xl font-bold leading-none">{selected.okreg}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ink-muted">
                  {selected.name} · {placeContextLabel(selected)}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
                  Okręg wyborczy nr {selected.okreg} — {district.name}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  województwo {district.voivodeship} · {mps.length} {mps.length === 1 ? 'poseł' : 'posłów'}
                </p>
              </div>
              <Link
                href={`/okreg/${selected.okreg}`}
                className="inline-flex flex-none items-center gap-1.5 self-start rounded-xl border border-black/10 bg-white px-3.5 py-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-black/[0.03] sm:self-center"
              >
                Strona okręgu
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>

          <h3 className="mb-3 mt-8 font-display text-lg font-semibold tracking-tight text-ink">
            Twoi reprezentanci w Sejmie
          </h3>
          {mps.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mps.map((mp) => (
                <li key={mp.id} className="animate-fade-in">
                  <MPCard mp={mp} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-black/5 bg-white/70 p-5 text-sm text-ink-muted">
              Brak danych o posłach z tego okręgu — spróbuj po najbliższej synchronizacji danych.
            </p>
          )}
        </section>
      ) : null}

      {!selected && !restoring ? <Hints /> : null}
    </div>
  )
}

function Hints() {
  return (
    <div className="mx-auto mt-8 max-w-xl text-center text-sm leading-relaxed text-ink-muted animate-fade-in">
      <p>
        Wpisz nazwę swojej miejscowości — miasta, wsi, a nawet przysiółka. Jeśli nazw jest więcej,
        rozróżnisz je po gminie i powiecie. Na tej podstawie wskażemy Twój okręg wyborczy i posłów,
        którzy go reprezentują.
      </p>
    </div>
  )
}
