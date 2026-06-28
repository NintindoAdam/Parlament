/**
 * Dokleja `basePath` (np. „/Parlament" na GitHub Pages) do ścieżek zasobów
 * statycznych z katalogu `public/`. Używać dla zwykłych <img src> — next/Link
 * i routing robią to automatycznie, ale surowe zasoby już nie.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''

export function asset(path: string): string {
  if (!path.startsWith('/')) path = '/' + path
  return BASE + path
}

export const basePath = BASE
