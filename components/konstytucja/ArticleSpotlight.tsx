import type { Landmark } from '@/lib/konstytucja-meta'

/** Reflektor na kluczowy artykuł: gwiazdka + „dlaczego ważny" (dodatek nad tekstem). */
export function ArticleSpotlight({ info, color }: { info: Landmark; color: string }) {
  return (
    <div
      className="mb-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5"
      style={{ borderColor: `${color}44`, backgroundColor: `${color}0d` }}
    >
      <span
        className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-white"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.5l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-1L12 2.5z" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
          Kluczowy artykuł · {info.tytul}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{info.why}</p>
      </div>
    </div>
  )
}
