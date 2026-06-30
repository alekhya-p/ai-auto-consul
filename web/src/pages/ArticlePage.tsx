import { Link, useParams } from "react-router-dom";
import { articleBySlug, type ArticleBlock } from "../lib/blog";
import { useI18n, useT } from "../lib/i18n";

/**
 * /blog/:slug - renders one article from the typed registry in
 * lib/blog.ts. Body is an array of typed blocks we render without
 * dangerouslySetInnerHTML - keeps the content safe from XSS and the
 * codebase free of Markdown tooling for v1.
 */
export function ArticlePage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const t = useT();
  const { lang } = useI18n();
  const a = articleBySlug(slug);

  if (!a) {
    return (
      <article className="content-page">
        <header className="content-hero">
          <p className="eyebrow">{t("nav.blog")}</p>
          <h1>{t("blog.notFound.title")}</h1>
        </header>
        <p className="lede">{t("blog.notFound.body")}</p>
        <p><Link to="/blog">← {t("blog.backToIndex")}</Link></p>
      </article>
    );
  }

  const body = a.body[lang];

  return (
    <article className="article-page">
      <p className="article-back">
        <Link to="/blog">← {t("blog.backToIndex")}</Link>
      </p>

      <header className="article-header">
        <p className="article-meta">
          {formatDate(a.publishedAt, lang)} · {t("blog.readTime", { n: a.readMinutes })}
        </p>
        <h1>{a.title[lang]}</h1>
        <p className="article-sub">{a.subtitle[lang]}</p>
        <ul className="article-tags">
          {a.tags.map((tag) => <li key={tag}>#{tag}</li>)}
        </ul>
      </header>

      <div className="article-body">
        {body.map((b, i) => <Block key={i} block={b} />)}
      </div>

      <aside className="article-cta">
        <h3>{t("blog.cta.title")}</h3>
        <p>{t("blog.cta.body")}</p>
        <div className="article-cta-row">
          <Link to="/" className="primary">{t("blog.cta.lookup")}</Link>
          <Link to="/prijzen" className="ghost">{t("blog.cta.pricing")}</Link>
        </div>
      </aside>
    </article>
  );
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.kind) {
    case "p":  return <p>{renderInline(block.text)}</p>;
    case "h2": return <h2>{block.text}</h2>;
    case "h3": return <h3>{block.text}</h3>;
    case "ul":
      return (
        <ul>
          {block.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}
        </ul>
      );
    case "ol":
      return (
        <ol>
          {block.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}
        </ol>
      );
    case "quote":
      return <blockquote>{block.text}</blockquote>;
    case "callout":
      return (
        <aside className={`article-callout article-callout-${block.tone}`}>
          <strong>{block.title}</strong>
          <p>{block.body}</p>
        </aside>
      );
  }
}

/**
 * Lightweight inline-markdown for body text: `**bold**` only. Anything
 * else is rendered as plain text. No raw HTML, no script-injection
 * surface. If we need richer formatting later, swap for a real parser.
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={`b${i++}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
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
