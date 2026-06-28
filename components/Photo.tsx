'use client'

import { useState } from 'react'
import { asset } from '@/lib/asset'

interface PhotoProps {
  id: number
  name: string
  /** true = duże zdjęcie z `photos/`, false = miniatura z `photos-mini/`. */
  full?: boolean
  hasPhoto: boolean
  color: string
  className?: string
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Zdjęcie posła z elegancką zastępczą grafiką (inicjały na tle koloru klubu),
 * gdy zdjęcie nie istnieje lub nie udało się go wczytać.
 */
export function Photo({ id, name, full = false, hasPhoto, color, className = '' }: PhotoProps) {
  const [failed, setFailed] = useState(false)
  const src = asset(`/${full ? 'photos' : 'photos-mini'}/${id}.jpg`)

  if (!hasPhoto || failed) {
    return (
      <div
        className={`grid place-items-center font-display font-semibold text-white ${className}`}
        style={{ background: `linear-gradient(145deg, ${color}, ${shade(color, -0.22)})` }}
        aria-hidden="true"
      >
        <span className="select-none" style={{ fontSize: '38%' }}>
          {initials(name)}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={`Zdjęcie: ${name}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  )
}

/** Przyciemnia/rozjaśnia kolor hex o zadany współczynnik (-1..1). */
function shade(hex: string, amount: number): string {
  const m = hex.replace('#', '')
  if (m.length !== 6) return hex
  const num = parseInt(m, 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const r = clamp((num >> 16) + 255 * amount)
  const g = clamp(((num >> 8) & 0xff) + 255 * amount)
  const b = clamp((num & 0xff) + 255 * amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
