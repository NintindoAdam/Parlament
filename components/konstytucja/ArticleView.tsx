import { artAnchor, type Artykul } from '@/lib/konstytucja'
import { LANDMARKS } from '@/lib/konstytucja-meta'
import { ArticleSpotlight } from './ArticleSpotlight'

/**
 * Wierny render artykułu Konstytucji: numer artykułu jako kolorowy znacznik,
 * ustępy (numerowane), punkty. Przy artykułach-kamieniach milowych — reflektor.
 * Tekst pochodzi z data/konstytucja.json — NIE zmieniamy go.
 */
export function ArticleView({ art, color }: { art: Artykul; color: string }) {
  const landmark = LANDMARKS[art.nr]
  const single = art.ustepy.length === 1 && !art.ustepy[0].nr && !art.ustepy[0].punkty

  return (
    <article id={artAnchor(art.nr)} className="scroll-mt-24 border-t border-black/5 py-5 first:border-t-0">
      <div className="flex items-baseline gap-3">
        <a
          href={`#${artAnchor(art.nr)}`}
          className="font-display text-sm font-bold tracking-tight text-white no-underline"
        >
          <span className="rounded-lg px-2 py-1" style={{ backgroundColor: color }}>
            Art. {art.nr}
          </span>
        </a>
      </div>

      {landmark ? (
        <div className="mt-3">
          <ArticleSpotlight info={landmark} color={color} />
        </div>
      ) : null}

      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink">
        {single ? (
          <p>{art.ustepy[0].text}</p>
        ) : (
          art.ustepy.map((u, i) => (
            <div key={i}>
              <p>
                {u.nr ? (
                  <span className="mr-1 font-semibold tabular-nums" style={{ color }}>
                    {u.nr}.
                  </span>
                ) : null}
                {u.text}
              </p>
              {u.punkty ? (
                <ol className="mt-1.5 space-y-1 pl-1">
                  {u.punkty.map((p) => (
                    <li key={p.nr} className="flex gap-2">
                      <span className="flex-none font-semibold tabular-nums text-ink-muted">{p.nr})</span>
                      <span>{p.text}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ))
        )}
      </div>
    </article>
  )
}
