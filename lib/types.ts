export interface MP {
  id: number
  firstName: string
  lastName: string
  /** Pełne imię i nazwisko w mianowniku. */
  name: string
  /** Kod klubu/koła (znormalizowany). */
  club: string
  districtName: string
  districtNum: number | null
  voivodeship: string
  profession: string
  birthDate: string | null
  birthLocation: string
  educationLevel: string
  email: string
  numberOfVotes: number | null
  active: boolean
  /** Czy w `public/photos/{id}.jpg` jest dostępne zdjęcie. */
  hasPhoto: boolean
}

export interface WikiInfo {
  extract: string
  url: string
}

export interface ClubMeta {
  code: string
  name: string
  color: string
  /** Pozycja na osi lewica → prawica (mniejsza = bardziej na lewo). */
  order: number
}

export interface ClubCount extends ClubMeta {
  count: number
}

export interface DataMeta {
  /** true = dane demonstracyjne (seed), false = realne z API Sejmu. */
  placeholder: boolean
  generatedAt: string
  term: number
  /** Data „stanu na” prezentowana w nagłówku. */
  asOf: string
}

export interface SeatPosition {
  x: number
  y: number
  angle: number
  row: number
}

export interface SeatLayout {
  width: number
  height: number
  /** Wizualny promień miejsca (mniejszy — z luką). */
  seatRadius: number
  /** Promień obszaru najazdu/kliknięcia (większy, ≈ cała komórka). */
  hitRadius: number
  seats: SeatPosition[]
}

export interface SeatedMP {
  mp: MP
  seat: SeatPosition
  index: number
}

/** Statystyki udziału posła w głosowaniach (tylko głosowania w czasie mandatu). */
export interface AttendanceStats {
  /** Głosowania, w których poseł figurował na liście (mianownik frekwencji). */
  total: number
  /** Oddane głosy: yes + no + abstain + głosowania listowe (VOTE_VALID). */
  cast: number
  yes: number
  no: number
  abstain: number
  absent: number
}

export interface AttendanceFile {
  generatedAt: string
  placeholder: boolean
  totalVotings: number
  lastVotingDate: string
  perMP: Record<string, AttendanceStats>
}

/** Minimalny, serializowalny opis posła dla list/kart po stronie klienta. */
export interface MiniMP {
  id: number
  name: string
  club: string
  hasPhoto: boolean
}

/** Lekki, serializowalny obiekt miejsca przekazywany do komponentów klienckich. */
export interface SeatDatum {
  id: number
  name: string
  club: string
  clubName: string
  color: string
  district: string
  districtNum: number | null
  voivodeship: string
  profession: string
  hasPhoto: boolean
  x: number
  y: number
}
