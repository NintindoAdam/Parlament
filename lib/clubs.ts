import type { ClubMeta } from './types'

/**
 * Metadane klubów i kół poselskich X kadencji Sejmu.
 * `order` wyznacza kolejność na osi lewica → prawica (rozmieszczenie w sali).
 * Kolory dobrane tak, by były czytelne i zbliżone do konwencji oficjalnego planu.
 */
export const CLUB_META: Record<string, ClubMeta> = {
  Lewica: { code: 'Lewica', name: 'Lewica', color: '#e11d48', order: 1 },
  Razem: { code: 'Razem', name: 'Razem', color: '#9f1239', order: 2 },
  KO: { code: 'KO', name: 'Koalicja Obywatelska', color: '#f97316', order: 3 },
  'Polska2050-TD': {
    code: 'Polska2050-TD',
    name: 'Polska 2050 (Trzecia Droga)',
    color: '#facc15',
    order: 4,
  },
  'PSL-TD': {
    code: 'PSL-TD',
    name: 'PSL – Trzecia Droga',
    color: '#16a34a',
    order: 5,
  },
  Demokracja: { code: 'Demokracja', name: 'Demokracja', color: '#0ea5e9', order: 6 },
  Centrum: { code: 'Centrum', name: 'Centrum', color: '#14b8a6', order: 7 },
  PiS: { code: 'PiS', name: 'Prawo i Sprawiedliwość', color: '#2563eb', order: 8 },
  Konfederacja: {
    code: 'Konfederacja',
    name: 'Konfederacja',
    color: '#78350f',
    order: 9,
  },
  KonfederacjaKP: {
    code: 'KonfederacjaKP',
    name: 'Konfederacja Korony Polskiej',
    color: '#b45309',
    order: 10,
  },
  'niez.': { code: 'niez.', name: 'Niezrzeszeni', color: '#94a3b8', order: 11 },
}

/** Aliasowanie różnych zapisów kodu klubu zwracanych przez API → kod kanoniczny. */
const ALIASES: Record<string, string> = {
  'Polska 2050': 'Polska2050-TD',
  Polska2050: 'Polska2050-TD',
  'Polska2050 - TD': 'Polska2050-TD',
  PSL: 'PSL-TD',
  'PSL/TD': 'PSL-TD',
  TD: 'PSL-TD',
  'Trzecia Droga': 'PSL-TD',
  'Konfederacja KP': 'KonfederacjaKP',
  'Konfederacja_KP': 'KonfederacjaKP',
  KKP: 'KonfederacjaKP',
  niez: 'niez.',
  Niezrzeszeni: 'niez.',
  'Lewica - Razem': 'Razem',
}

export function normalizeClub(raw: string | null | undefined): string {
  if (!raw) return 'niez.'
  const trimmed = raw.trim()
  if (CLUB_META[trimmed]) return trimmed
  if (ALIASES[trimmed]) return ALIASES[trimmed]
  return trimmed
}

export function getClubMeta(raw: string | null | undefined): ClubMeta {
  const code = normalizeClub(raw)
  return (
    CLUB_META[code] ?? {
      code,
      name: code,
      color: '#94a3b8',
      order: 90,
    }
  )
}

/** Stała kolejność klubów do legendy i sortowania miejsc. */
export function clubOrder(raw: string | null | undefined): number {
  return getClubMeta(raw).order
}
