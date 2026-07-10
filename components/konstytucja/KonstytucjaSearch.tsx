'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { artAnchor, fetchKonstSearch, foldKonst, type SearchItem } from '@/lib/konstytucja'
import { ROZDZIAL_META } from '@/lib/konstytucja-meta'

/**
 * Wyszukiwarka po całym tekście Konstytucji. Ładuje kompaktowy indeks
 * (public/konstytucja/search.json) i filtruje po treści; wynik linkuje do
 * strony rozdziału z kotwicą artykułu (/konstytucja/{roz}#art-N).
 */
export function KonstytucjaSearch() {
  const [items, setItems] = useState<SearchItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchKonstSearch().then((v) => {
      if (cancelled) return
      if (v) setItems(v)
      else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const results = useMemo(() => {
    const q = foldKonst(query.trim())
    if (q.length < 2 || !items) return []
    const out: SearchItem[] = []
    for (const it of items) {
      if (foldKonst(`art. ${it.art} ${it.text}`).includes(q)) out.push(it)
      if (out.length >= 40) break
    }
    return out
  }, [items, query])

  return (
    <div>
      <label className="block">
        <span className="sr-only">Szukaj w Konstytucji</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={'Szukaj w tekście (np. „godność", „wolność słowa", „art. 30")…'}
          disabled={!items && !failed}
          className="w-full rounded-xl border border-black/10 bg-white/90 px-4 py-2.5 text-sm font-medium text-ink shadow-sm outline-none transition-shadow placeholder:font-normal placeholder:text-ink-muted/70 focus:border-ink/30 focus:shadow-soft disabled:opacity-60"
        />
      </label>

      {failed ? (
        <p className="mt-2 text-xs text-ink-muted">Nie udało się wczytać indeksu wyszukiwania.</p>
      ) : null}

      {query.trim().length >= 2 ? (
        <ul className="mt-3 space-y-2">
          {results.map((r) => {
            const m = ROZDZIAL_META[r.roz]
            return (
              <li key={r.art}>
                <Link
                  href={`/konstytucja/${r.roz}#${artAnchor(r.art)}`}
                  className="block rounded-xl border border-black/5 bg-white/80 p-3 shadow-soft transition-shadow hover:shadow-card"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: m?.color ?? '#334155' }}>
                      Art. {r.art}
                    </span>
                    <span className="truncate text-[11px] text-ink-muted">{m?.nazwa}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">{r.text}</p>
                </Link>
              </li>
            )
          })}
          {results.length === 0 ? (
            <li className="rounded-xl border border-black/10 bg-white/70 px-4 py-4 text-center text-sm text-ink-muted">
              Brak artykułów pasujących do „{query.trim()}".
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
