/** Minimalistyczne ikony liniowe rozdziałów Konstytucji (klucz = slug). */
const PATHS: Record<string, React.ReactNode> = {
  // I — państwo: flaga
  rzeczpospolita: <path d="M6 3v18M6 4h12l-2.5 3.5L18 11H6" />,
  // II — godność/prawa: człowiek
  'wolnosci-prawa-obowiazki': <path d="M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 20a7 7 0 0114 0" />,
  // III — hierarchia prawa: warstwy
  'zrodla-prawa': <path d="M12 3l9 5-9 5-9-5 9-5zM3.5 12L12 17l8.5-5M3.5 16L12 21l8.5-5" />,
  // IV — parlament: budynek z kolumnami
  'sejm-i-senat': <path d="M3 21h18M4 21V11m4 10V11m8 10V11m4 10V11M3 11h18l-9-6-9 6z" />,
  // V — Prezydent: gwiazda/order
  prezydent: <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 8.7l5.4-.8L12 3z" />,
  // VI — rząd: teczka
  'rada-ministrow': <path d="M3 8h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8zM8 8V6a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18" />,
  // VII — samorząd: dom/wspólnota
  'samorzad-terytorialny': <path d="M4 11l8-6 8 6M6 10v9h12v-9M10 19v-5h4v5" />,
  // VIII — sądy: waga
  'sady-i-trybunaly': <path d="M12 3v18M7 21h10M4 6h16M6 6l-2.5 5h5L6 6zM18 6l-2.5 5h5L18 6z" />,
  // IX — kontrola: lupa
  'kontrola-panstwowa': <path d="M11 5a6 6 0 100 12 6 6 0 000-12zM20 20l-4.5-4.5" />,
  // X — finanse: monety
  'finanse-publiczne': <path d="M12 6c3.9 0 7 1.3 7 3s-3.1 3-7 3-7-1.3-7-3 3.1-3 7-3zM5 9v6c0 1.7 3.1 3 7 3s7-1.3 7-3V9" />,
  // XI — stany nadzwyczajne: alert
  'stany-nadzwyczajne': <path d="M12 4l9 16H3L12 4zM12 10v4M12 17v.5" />,
  // XII — zmiana: pióro
  'zmiana-konstytucji': <path d="M4 20l1.5-4.5L15 6l3 3-9.5 9.5L4 20zM13 8l3 3" />,
  // XIII — przepisy końcowe: klepsydra
  'przepisy-koncowe': <path d="M7 3h10M7 21h10M8 3c0 5 4 5 4 9 0-4 4-4 4-9M8 21c0-5 4-5 4-9 0 4 4 4 4 9" />,
}

export function RozdzialIcon({ slug, size = 22, className }: { slug: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[slug] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  )
}
