'use client'

import { useEffect, useState } from 'react'
import {
  fetchSittingIndex,
  fetchVotingDetail,
  fetchVotingsManifest,
  formatVoteParam,
  parseVoteParam,
  type SittingIndex,
  type VotingDetail,
  type VotingsManifest,
} from '@/lib/votings'

/**
 * Wspólna logika wyboru głosowania (strona główna i profil posła):
 * manifest (lazy) → posiedzenie (preselekcja najnowszego) → indeks →
 * głosowanie → szczegóły (+ opcja głosowania listowego). Wybór zapisuje się
 * w URL (?g=posiedzenie-głosowanie[-opcja]) przez history.replaceState;
 * odtwarzanie czyta window.location.search w mount effect (celowo NIE
 * useSearchParams — pułapka Suspense przy statycznym eksporcie).
 */
export function useVotingSelection(enabled: boolean, onRestoreFromUrl?: () => void) {
  const [manifest, setManifest] = useState<VotingsManifest | null>(null)
  const [manifestFailed, setManifestFailed] = useState(false)
  const [sitting, setSitting] = useState<number | null>(null)
  const [index, setIndex] = useState<SittingIndex | null>(null)
  const [indexLoading, setIndexLoading] = useState(false)
  const [votingNum, setVotingNum] = useState<number | null>(null)
  const [option, setOption] = useState<string | null>(null)
  const [detail, setDetail] = useState<VotingDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [restored, setRestored] = useState(false)
  // Zwiększany przez retry(), by wymusić ponowne pobranie indeksu/szczegółów.
  const [reloadKey, setReloadKey] = useState(0)

  // Odtworzenie wyboru z URL (raz, przy montowaniu).
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('g')
    const parsed = raw ? parseVoteParam(raw) : null
    if (parsed) {
      setSitting(parsed.sitting)
      setVotingNum(parsed.voting)
      setOption(parsed.option)
      onRestoreFromUrl?.()
    }
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Manifest pobierany leniwie po włączeniu widoku głosowań.
  useEffect(() => {
    if (!enabled || manifest) return
    let cancelled = false
    fetchVotingsManifest().then((m) => {
      if (cancelled) return
      if (!m) {
        setManifestFailed(true)
        return
      }
      setManifest(m)
      setSitting((current) => current ?? m.sittings[0]?.num ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, manifest])

  // Indeks wybranego posiedzenia.
  useEffect(() => {
    if (!enabled || sitting == null) return
    let cancelled = false
    setIndexLoading(true)
    setFailed(false)
    fetchSittingIndex(sitting).then((idx) => {
      if (cancelled) return
      setIndex(idx)
      setIndexLoading(false)
      if (!idx) setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, sitting, reloadKey])

  // Szczegóły wybranego głosowania.
  useEffect(() => {
    if (!enabled || sitting == null || votingNum == null) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setFailed(false)
    fetchVotingDetail(sitting, votingNum).then((d) => {
      if (cancelled) return
      setDetail(d)
      setDetailLoading(false)
      if (!d) setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, sitting, votingNum, reloadKey])

  /** Czy szczegóły to głosowanie listowe z pełnym rozbiciem na opcje? */
  const hasOptions = !!(
    detail &&
    detail.options &&
    detail.options.length > 0 &&
    detail.votes.l &&
    Object.keys(detail.votes.l).length > 0
  )

  // Domyślna opcja głosowania listowego: ta z największym poparciem.
  useEffect(() => {
    if (!hasOptions || !detail?.votes.l) return
    const valid = option != null && detail.votes.l[option] !== undefined
    if (valid) return
    const best = Object.entries(detail.votes.l).sort((a, b) => b[1].length - a[1].length)[0]
    setOption(best ? best[0] : null)
  }, [detail, hasOptions, option])

  // Synchronizacja URL.
  useEffect(() => {
    if (!restored) return
    const url = new URL(window.location.href)
    if (enabled && sitting != null && votingNum != null) {
      url.searchParams.set('g', formatVoteParam(sitting, votingNum, hasOptions ? option : null))
    } else {
      url.searchParams.delete('g')
    }
    window.history.replaceState(null, '', url)
  }, [enabled, sitting, votingNum, option, hasOptions, restored])

  function selectSitting(num: number) {
    setSitting(num)
    setVotingNum(null)
    setOption(null)
    setDetail(null)
  }

  function selectVoting(num: number) {
    setVotingNum(num)
    setOption(null)
  }

  function retryManifest() {
    setManifestFailed(false)
    fetchVotingsManifest(true).then((m) => {
      if (m) {
        setManifest(m)
        setSitting((current) => current ?? m.sittings[0]?.num ?? null)
      } else {
        setManifestFailed(true)
      }
    })
  }

  /** Ponów pobranie indeksu posiedzenia / szczegółów po błędzie sieci. */
  function retry() {
    setFailed(false)
    setReloadKey((k) => k + 1)
  }

  return {
    manifest,
    manifestFailed,
    retryManifest,
    sitting,
    selectSitting,
    index,
    indexLoading,
    votingNum,
    selectVoting,
    option,
    setOption,
    hasOptions,
    detail,
    detailLoading,
    failed,
    retry,
  }
}
