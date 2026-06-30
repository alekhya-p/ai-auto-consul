import "./chat-v2.css";

export type Source = "rdw" | "web" | "ai";

interface SourceBadgeProps {
  source: Source;
  lang?: "nl" | "en";
}

const labels: Record<Source, { nl: string; en: string }> = {
  rdw: { nl: "RDW geverifieerd", en: "RDW verified" },
  web: { nl: "Web", en: "Web" },
  ai: { nl: "AI-schatting", en: "AI estimate" },
};

function RdwIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2 6 5 9 10 3" />
    </svg>
  );
}

function WebIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="5" />
      <path d="M1 6h10M6 1c-1.5 1.5-2 3-2 5s.5 3.5 2 5M6 1c1.5 1.5 2 3 2 5s-.5 3.5-2 5" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 1l1.2 3.3H11L8.4 6.4l1 3.1L6 7.8l-3.4 1.7 1-3.1L1 4.3h3.8z" />
    </svg>
  );
}

const icons: Record<Source, () => JSX.Element> = {
  rdw: RdwIcon,
  web: WebIcon,
  ai: AiIcon,
};

export function SourceBadge({ source, lang = "nl" }: SourceBadgeProps) {
  const Icon = icons[source];
  return (
    <span className={`cv2-source-badge cv2-source-badge--${source}`}>
      <span className="cv2-source-badge-icon">
        <Icon />
      </span>
      {labels[source][lang]}
    </span>
  );
}
