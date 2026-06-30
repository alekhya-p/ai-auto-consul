import { ChatMarkdown } from "./ChatMarkdown";
import { SourceBadge } from "./SourceBadge";
import "./chat-v2.css";

export interface SourcesCardProps {
  lang?: "nl" | "en";
  loading?: boolean;
  query?: string;
  data?: {
    answer?: string;
    sources?: { title?: string; uri?: string }[];
    error?: string;
  };
}

const t = {
  searching: { nl: "Web doorzoeken…", en: "Searching the web…" },
  sources: { nl: "Bronnen", en: "Sources" },
  failed: { nl: "Zoeken mislukt", en: "Search failed" },
};

function hostname(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return uri;
  }
}

/** Opaque grounding/redirect hosts whose real destination lives in the title. */
const REDIRECT_HOST = /(^|\.)vertexaisearch\.cloud\.google\.com$|(^|\.)googleusercontent\.com$|grounding-api/i;

/**
 * Pick the human-readable source to show as the (blue) link label. Vertex AI
 * Search returns opaque redirect URIs (vertexaisearch.cloud.google.com/…) and
 * stashes the actual domain in the title (e.g. "ooyyo.com"). Showing the
 * redirect host helped no one - surface the real destination instead.
 */
function displaySource(s: { title?: string; uri?: string }): { host: string; title?: string } {
  const rawHost = hostname(s.uri!);
  if (REDIRECT_HOST.test(rawHost) && s.title) {
    const real = s.title.replace(/^https?:\/\//, "").replace(/^www\./, "").trim();
    return { host: real || rawHost };
  }
  return { host: rawHost, title: s.title && s.title !== rawHost ? s.title : undefined };
}

/**
 * Generative-UI card for the web_search tool. Renders the cited answer plus a
 * deduped list of real source links, badged as live-web provenance - the
 * "🌐 Web" half of the verified-vs-estimate-vs-web story.
 */
export function SourcesCard({ lang = "nl", loading, query, data }: SourcesCardProps) {
  if (loading) {
    return (
      <div className="cv2-sources-card card">
        <div className="cv2-sources-header">
          <span className="cv2-sources-fetching">
            {t.searching[lang]}{query ? ` "${query}"` : ""}
          </span>
        </div>
        <div className="vehicle-data-skeleton">
          <div className="skeleton-line w-80" />
          <div className="skeleton-line w-60" />
        </div>
      </div>
    );
  }

  if (data?.error || (!data?.answer && (data?.sources?.length ?? 0) === 0)) {
    return (
      <div className="cv2-sources-card card cv2-sources-card-error">
        <p style={{ margin: 0, color: "var(--ink-soft)" }}>{t.failed[lang]}</p>
      </div>
    );
  }

  const sources = (data?.sources ?? []).filter((s) => s.uri);
  const hasSources = sources.length > 0;

  // The synthesized answer IS the consolidated summary the user wants - render
  // it as the body of the card. The sources below are compact references, not
  // the answer. (Previously the answer was hidden whenever citations existed,
  // which left web-search turns showing only a wall of links.) The agent keeps
  // its own prose to a one-line takeaway so this isn't duplicated.
  const shown = sources.slice(0, MAX_SOURCES);
  const extra = sources.length - shown.length;

  return (
    <div className="cv2-sources-card card">
      {data?.answer && <ChatMarkdown content={data.answer} />}

      {hasSources && (
        <div className="cv2-sources-list">
          <span className="cv2-sources-list-label">{t.sources[lang]}</span>
          <ol>
            {shown.map((s, i) => {
              const d = displaySource(s);
              return (
                <li key={s.uri ?? i}>
                  <a href={s.uri} target="_blank" rel="noopener noreferrer">
                    <span className="cv2-source-host">{d.host}</span>
                    {d.title && <span className="cv2-source-title">{d.title}</span>}
                  </a>
                </li>
              );
            })}
          </ol>
          {extra > 0 && (
            <span className="cv2-sources-more">
              +{extra} {lang === "nl" ? "meer" : "more"}
            </span>
          )}
        </div>
      )}

      <div className="cv2-sources-footer">
        <SourceBadge source="web" lang={lang} />
      </div>
    </div>
  );
}

/** Cap the visible reference links so the card stays a summary, not a link dump. */
const MAX_SOURCES = 6;
