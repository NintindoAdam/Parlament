import type { SeatLayout, SeatPosition } from './types'

const INNER_RADIUS = 168
const OUTER_RADIUS = 480
const PAD_X = 30
const PAD_TOP = 28
const PAD_BOTTOM = 30

/**
 * Generuje pozycje miejsc w półokręgu (hemicykl) dla `n` mandatów.
 *
 * Algorytm „parliament arch": miejsca rozkładane są na współśrodkowych łukach
 * (rzędach) wewnątrz półokręgu 180°. Liczba miejsc w rzędzie jest proporcjonalna
 * do jego promienia. Liczbę rzędów dobieramy tak, by „komórka" przypadająca na
 * jedno miejsce (mniejszy z odstępów: między rzędami i wzdłuż łuku) była jak
 * największa — dzięki temu miejsca nie nachodzą na siebie i mają wyraźne luki.
 *
 * Miejsca zwracane są w kolejności „czytania" sali: od lewej (kąt = π) do prawej
 * (kąt = 0), co pozwala wypełniać je posłami posortowanymi wg sceny politycznej.
 */
export function computeHemicycle(n: number): SeatLayout {
  const cx = OUTER_RADIUS + PAD_X
  const cy = OUTER_RADIUS + PAD_TOP
  const width = cx * 2
  const height = cy + PAD_BOTTOM

  if (n <= 0) {
    return { width, height, seatRadius: 10, hitRadius: 14, seats: [] }
  }

  const rows = chooseRowCount(n)
  const { radii, counts, cell } = rowStats(n, rows)

  // Wizualny rozmiar miejsca = 60% komórki (luki ~40%); obszar najazdu ≈ cała komórka.
  const seatRadius = Math.max(4, (cell / 2) * 0.6)
  const hitRadius = Math.max(seatRadius, (cell / 2) * 0.96)

  const seats: SeatPosition[] = []
  for (let i = 0; i < rows; i++) {
    const r = radii[i]
    const c = counts[i]
    for (let j = 0; j < c; j++) {
      const t = c === 1 ? 0.5 : j / (c - 1)
      const angle = Math.PI - t * Math.PI
      const x = cx + r * Math.cos(angle)
      const y = cy - r * Math.sin(angle)
      seats.push({ x, y, angle, row: i })
    }
  }

  // Kolejność wypełniania: po kącie (lewo→prawo), przy zbliżonym kącie od rzędu
  // zewnętrznego do wewnętrznego — tworzy spójne, pionowe „kliny" klubów.
  seats.sort((a, b) => {
    if (Math.abs(a.angle - b.angle) > 1e-6) return b.angle - a.angle
    return b.row - a.row
  })

  return { width, height, seatRadius, hitRadius, seats }
}

interface RowStats {
  radii: number[]
  counts: number[]
  /** Najmniejszy z odstępów (radialny / wzdłuż łuku) przypadający na miejsce. */
  cell: number
}

function rowStats(n: number, rows: number): RowStats {
  const radii: number[] = []
  for (let i = 0; i < rows; i++) {
    radii.push(rows === 1 ? INNER_RADIUS : INNER_RADIUS + ((OUTER_RADIUS - INNER_RADIUS) * i) / (rows - 1))
  }
  const radiusSum = radii.reduce((a, b) => a + b, 0)
  const counts = radii.map((r) => Math.max(1, Math.round((n * r) / radiusSum)))
  fixRounding(counts, radii, n)

  const rowSpacing = rows > 1 ? (OUTER_RADIUS - INNER_RADIUS) / (rows - 1) : INNER_RADIUS
  const minAngularGap = radii.reduce((min, r, i) => {
    const c = counts[i]
    const gap = c > 1 ? (Math.PI * r) / (c - 1) : Math.PI * r
    return Math.min(min, gap)
  }, Infinity)
  const cell = Math.min(rowSpacing, minAngularGap)
  return { radii, counts, cell }
}

/** Dobiera liczbę rzędów maksymalizującą rozmiar komórki (najlepsze odstępy). */
function chooseRowCount(n: number): number {
  let bestRows = 8
  let bestCell = -1
  for (let rows = 6; rows <= 22; rows++) {
    const { cell } = rowStats(n, rows)
    if (cell > bestCell) {
      bestCell = cell
      bestRows = rows
    }
  }
  return bestRows
}

/** Dostraja sumę `counts` do `target`, zmieniając najszersze rzędy. */
function fixRounding(counts: number[], radii: number[], target: number): void {
  let diff = target - counts.reduce((a, b) => a + b, 0)
  const byRadius = radii.map((_, i) => i).sort((a, b) => radii[b] - radii[a])
  let k = 0
  while (diff !== 0 && byRadius.length > 0) {
    const idx = byRadius[k % byRadius.length]
    if (diff > 0) {
      counts[idx] += 1
      diff -= 1
    } else if (counts[idx] > 1) {
      counts[idx] -= 1
      diff += 1
    }
    k++
    if (k > 100000) break
  }
}
