import { Link } from "react-router-dom";
import { ARTICLES } from "../lib/blog";
import { useI18n, useT } from "../lib/i18n";

/**
 * /blog - index of articles. Ordered most-recent-first. Each article is
 * a typed config in lib/blog.ts; the per-article page is ArticlePage at
 * /blog/:slug.
 */
export function BlogPage() {
  const t = useT();
  const { lang } = useI18n();

  return (
    <article className="blog-index">
      <header className="content-hero">
        <p className="eyebrow">{t("nav.blog")}</p>
        <h1>{t("blog.title")}</h1>
        <p className="lede">{t("blog.subtitle")}</p>
      </header>

      <ul className="blog-cards">
        {ARTICLES.map((a, i) => (
          <li key={a.slug} className={i === 0 ? "blog-card-lead" : undefined}>
            <Link to={`/blog/${a.slug}`} className={`blog-card${a.draft ? " blog-card-draft" : ""}`}>
              <p className="blog-card-meta">
                {formatDate(a.publishedAt, lang)} · {t("blog.readTime", { n: a.readMinutes })}
                {a.draft && <span className="blog-card-pill">{t("blog.comingSoon")}</span>}
              </p>
              <h2>{a.title[lang]}</h2>
              <p className="blog-card-sub">{a.subtitle[lang]}</p>
              <ul className="blog-card-tags">
                {a.tags.map((tag) => (
                  <li key={tag}>#{tag}</li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

function formatDate(iso: string, lang: "nl" | "en"): string {
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "nl-NL", {
      day: "numeric", month: "long", year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
