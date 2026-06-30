import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteThread, listThreads } from "../chat-v2/history";
import { listChatSessions } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  loadLocalChatSessions,
  saveLocalChatSessions,
  type LocalChatSession,
} from "../../lib/chatSessionsLocal";
import { useI18n, useT } from "../../lib/i18n";

function mergeSessions(
  local: LocalChatSession[],
  v1: { sessionId: string; title: string; lastTurnAt: string }[],
  agentIds: string[],
  untitled: string,
): LocalChatSession[] {
  const byId = new Map<string, LocalChatSession>();
  for (const s of local) {
    byId.set(s.id, s);
  }
  for (const s of v1) {
    if (!byId.has(s.sessionId)) {
      byId.set(s.sessionId, {
        id: s.sessionId,
        title: s.title || untitled,
        createdAt: s.lastTurnAt,
      });
    }
  }
  for (const id of agentIds) {
    if (!byId.has(id)) {
      byId.set(id, { id, title: untitled, createdAt: new Date().toISOString() });
    }
  }
  return [...byId.values()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);
}

/**
 * Account hub: chat threads from local titles, GET /v1/sessions, and agent-v2 list.
 */
export function AccountChatThreads() {
  const t = useT();
  const { lang } = useI18n();
  const auth = useAuth();
  const { idToken } = auth;
  const [threads, setThreads] = useState<LocalChatSession[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = loadLocalChatSessions();
      const untitled = t("chat.history.untitled");
      let v1: Awaited<ReturnType<typeof listChatSessions>> = [];
      let agentIds: string[] = [];
      if (idToken) {
        [v1, agentIds] = await Promise.all([
          listChatSessions(20),
          listThreads(idToken),
        ]);
      }
      if (!cancelled) {
        setThreads(mergeSessions(local, v1, agentIds, untitled));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idToken, t, auth.user?.uid]);

  async function onDeleteOne(id: string) {
    if (!idToken) return;
    setBusy(true);
    try {
      await deleteThread(idToken, id);
      const next = (threads ?? []).filter((s) => s.id !== id);
      saveLocalChatSessions(next);
      setThreads(next);
    } finally {
      setBusy(false);
    }
  }

  async function onClearAll() {
    if (!idToken || !threads?.length) return;
    if (!window.confirm(t("account.chats.clearConfirm"))) return;
    setBusy(true);
    try {
      await Promise.allSettled(threads.map((s) => deleteThread(idToken, s.id)));
      saveLocalChatSessions([]);
      setThreads([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-chats">
      <header className="account-section-head">
        <h2>{t("account.chats.title")}</h2>
        <div className="account-chats-actions">
          <Link to="/v2/chat" className="account-link">
            {t("account.chats.new")}
          </Link>
          {threads && threads.length > 0 && idToken && (
            <button
              type="button"
              className="ghost small"
              disabled={busy}
              onClick={() => void onClearAll()}
            >
              {t("account.chats.clearAll")}
            </button>
          )}
        </div>
      </header>
      {threads === null && (
        <p className="account-skeleton">{t("account.chats.loading")}</p>
      )}
      {threads !== null && threads.length === 0 && (
        <p className="account-empty">{t("account.chats.empty")}</p>
      )}
      {threads && threads.length > 0 && (
        <>
          <p className="account-chats-hint">{t("account.chats.clearHint")}</p>
          <ul className="account-chats-list">
          {threads.map((s) => (
            <li key={s.id} className="account-chat-row">
              <Link
                to={`/v2/chat?session=${encodeURIComponent(s.id)}`}
                className="account-chat-link"
              >
                <span className="account-chat-title">{s.title}</span>
                <span className="account-chat-meta">
                  {formatRelative(s.createdAt, lang)}
                </span>
              </Link>
              {idToken && (
                <button
                  type="button"
                  className="ghost small account-chat-delete"
                  disabled={busy}
                  aria-label={t("account.chats.delete")}
                  onClick={() => void onDeleteOne(s.id)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        </>
      )}
    </section>
  );
}

function formatRelative(iso: string, lang: "nl" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const rtf = new Intl.RelativeTimeFormat(lang === "nl" ? "nl-NL" : "en-GB", {
    numeric: "auto",
  });
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (Math.abs(days) < 1) return rtf.format(0, "day");
  return rtf.format(days, "day");
}
