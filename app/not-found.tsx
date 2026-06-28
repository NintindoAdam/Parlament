import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="font-display text-6xl font-bold text-ink/15">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Nie znaleziono strony</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Posła lub strony, której szukasz, nie ma. Wróć do sali posiedzeń.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-soft"
      >
        Sala posiedzeń
      </Link>
    </div>
  )
}
