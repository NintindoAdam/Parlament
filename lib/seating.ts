import type { SeatLayout, SeatPosition } from './types'

/**
 * Generuje pozycje miejsc w półokręgu (hemicykl) dla `n` mandatów.
 *
 * Algorytm „parliament arch": miejsca rozkładane są na współśrodkowych łukach
 * (rzędach) wewnątrz półokręgu 180°. Liczba miejsc w rzędzie jest proporcjonalna
 * do jego promienia, dzięki czemu odstępy między miejscami są zbliżone w całej
 * sali. Miejsca zwracane są w kolejności „czytania" sali: rzędami, a w obrębie
 * rzędu od lewej (kąt = π) do prawej (kąt = 0). To pozwala wypełniać je kolejno
 * posłami posortowanymi wg sceny politycznej, tworząc spójne bloki klubów.
 */
export function computeHemicycle(n: number): SeatLayout {
  const width = 1000
  const outerRadius = 470
  const innerRadius = 190
  const cx = width / 2
  const cy = outerRadius + 24 // odrobina marginesu u góry

  if (n <= 0) {
    return { width, height: cy + 40, seatRadius: 12, seats: [] }
  }

  const rows = chooseRowCount(n, innerRadius, outerRadius)
  const radii: number[] = []
  for (let i = 0; i < rows; i++) {
    radii.push(rows === 1 ? innerRadius : innerRadius + ((outerRadius - innerRadius) * i) / (rows - 1))
  }

  // Liczba miejsc na rząd proporcjonalna do promienia.
  const radiusSum = radii.reduce((a, b) => a + b, 0)
  const counts = radii.map((r) => Math.max(1, Math.round((n * r) / radiusSum)))

  // Korekta zaokrągleń tak, aby suma == n (dodajemy/odejmujemy od najszerszych rzędów).
  fixRounding(counts, radii, n)

  // Promień pojedynczego miejsca: dopasowany do najgęstszego rzędu, by się nie nakładały.
  const minGap = radii.reduce((min, r, i) => {
    const c = counts[i]
    const gap = c > 1 ? (Math.PI * r) / (c - 1) : Math.PI * r
    return Math.min(min, gap)
  }, Infinity)
  const seatRadius = Math.max(6, Math.min(18, (minGap / 2) * 0.82))

  const seats: SeatPosition[] = []
  for (let i = 0; i < rows; i++) {
    const r = radii[i]
    const c = counts[i]
    for (let j = 0; j < c; j++) {
      // Kąt od π (lewa strona) do 0 (prawa). Dla rzędu z jednym miejscem -> środek.
      const t = c === 1 ? 0.5 : j / (c - 1)
      const angle = Math.PI - t * Math.PI
      const x = cx + r * Math.cos(angle)
      const y = cy - r * Math.sin(angle)
      seats.push({ x, y, angle, row: i })
    }
  }

  // Sortowanie do kolejności wypełniania: po kącie (lewo→prawo), a przy zbliżonym
  // kącie od rzędu zewnętrznego do wewnętrznego — tworzy czyste, pionowe „kliny"
  // klubów, jak w realnej sali sejmowej.
  seats.sort((a, b) => {
    if (Math.abs(a.angle - b.angle) > 1e-6) return b.angle - a.angle
    return b.row - a.row
  })

  const height = cy + 30
  return { width, height, seatRadius, seats }
}

/** Najmniejsza liczba rzędów, przy której miejsca nie są nadmiernie ściśnięte. */
function chooseRowCount(n: number, innerRadius: number, outerRadius: number): number {
  const minSeatGap = 30 // minimalny odstęp środków miejsc wzdłuż łuku [px]
  for (let rows = 1; rows <= 40; rows++) {
    const radii: number[] = []
    for (let i = 0; i < rows; i++) {
      radii.push(rows === 1 ? innerRadius : innerRadius + ((outerRadius - innerRadius) * i) / (rows - 1))
    }
    const radiusSum = radii.reduce((a, b) => a + b, 0)
    const counts = radii.map((r) => Math.max(1, Math.round((n * r) / radiusSum)))
    fixRounding(counts, radii, n)
    const fits = radii.every((r, i) => {
      const c = counts[i]
      if (c <= 1) return true
      return (Math.PI * r) / (c - 1) >= minSeatGap
    })
    if (fits) return rows
  }
  return 14
}

/** Dostraja sumę `counts` do `target`, zmieniając najszersze rzędy. */
function fixRounding(counts: number[], radii: number[], target: number): void {
  let diff = target - counts.reduce((a, b) => a + b, 0)
  // Indeksy rzędów posortowane wg promienia malejąco (najwięcej miejsca = pierwszy).
  const byRadius = radii.map((r, i) => i).sort((a, b) => radii[b] - radii[a])
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
