export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-white/40">
      <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs leading-relaxed text-ink-muted sm:px-6">
        <p>
          Dane pochodzą z{' '}
          <a
            href="https://api.sejm.gov.pl"
            className="font-medium text-ink-soft underline decoration-black/20 underline-offset-2 hover:decoration-black/50"
            target="_blank"
            rel="noopener noreferrer"
          >
            otwartego API Sejmu RP
          </a>{' '}
          oraz Wikipedii. Projekt niekomercyjny, edukacyjny.
        </p>
      </div>
    </footer>
  )
}
