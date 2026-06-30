import { useEffect, useState } from "react";
import { useT } from "../../lib/i18n";
import "./chat-v2.css";

interface Session {
  id: string;
  title: string;
  createdAt: string;
}

interface ChatSidebarProps {
  sessions: Session[];
  currentSessionId: string;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  deleteBusyId?: string | null;
  canDelete?: boolean;
  onClose: () => void;
  isOpen: boolean;
  lang: "nl" | "en";
}

function formatRelativeDate(iso: string, lang: "nl" | "en"): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return lang === "nl" ? "Vandaag" : "Today";
    if (diffDays === 1) return lang === "nl" ? "Gisteren" : "Yesterday";
    if (diffDays < 7) {
      return lang === "nl" ? `${diffDays} dagen geleden` : `${diffDays} days ago`;
    }
    return new Intl.DateTimeFormat(lang === "nl" ? "nl-NL" : "en-GB", {
      day: "numeric",
      month: "short",
    }).format(date);
  } catch {
    return "";
  }
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  deleteBusyId = null,
  canDelete = false,
  onClose,
  isOpen,
  lang,
}: ChatSidebarProps) {
  const t = useT();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="cv2-sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className="cv2-sidebar"
        aria-label={t("chat.history.label")}
        aria-hidden={isMobile && !isOpen ? true : undefined}
      >
        <div className="cv2-sidebar-header">
          <button
            className="cv2-new-chat-btn"
            onClick={onNewChat}
            type="button"
            aria-label={t("chat.newChat")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>{t("chat.newChat")}</span>
          </button>
          {isMobile && (
            <button
              className="cv2-sidebar-close"
              onClick={onClose}
              type="button"
              aria-label={t("chat.sidebar.close")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>
          )}
        </div>

        <nav className="cv2-session-list" aria-label={t("chat.history.label")}>
          {sessions.length === 0 ? (
            <div className="cv2-session-empty">{t("chat.history.empty")}</div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`cv2-session-row${s.id === currentSessionId ? " active" : ""}`}
              >
                <button
                  className="cv2-session-item"
                  onClick={() => {
                    onSelectSession(s.id);
                    if (isMobile) onClose();
                  }}
                  type="button"
                >
                  <span className="cv2-session-title">{s.title}</span>
                  <span className="cv2-session-date">{formatRelativeDate(s.createdAt, lang)}</span>
                </button>
                {canDelete && onDeleteSession && (
                  <button
                    type="button"
                    className="cv2-session-delete"
                    aria-label={t("chat.history.delete", { title: s.title })}
                    disabled={deleteBusyId === s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.id);
                    }}
                  >
                    {deleteBusyId === s.id ? "…" : "×"}
                  </button>
                )}
              </div>
            ))
          )}
        </nav>
      </aside>
    </>
  );
}
