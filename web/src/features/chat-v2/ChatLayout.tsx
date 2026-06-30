import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NlPlate } from "../../components/NlPlate";
import { useAuth } from "../../lib/auth";
import {
  loadLocalChatSessions,
  normalizePlate,
  removeLocalChatSession,
  saveLocalChatSessions,
  type LocalChatSession,
} from "../../lib/chatSessionsLocal";
import { useT } from "../../lib/i18n";
import { getCached, prettyPlate } from "../../lib/voertuigCache";
import { deleteThread } from "./history";
import { ChatCreditMeter } from "./ChatCreditMeter";
import { ChatSidebar } from "./ChatSidebar";
import { ChatMessages } from "./ChatMessages";
import { listThreads } from "./history";
import "./chat-v2.css";

interface ChatLayoutProps {
  plate?: string;
  lang: "nl" | "en";
  /** Resume a thread opened via ?session= or /account. */
  initialSessionId?: string;
  /** Set when a run was blocked by the quota gate (429) - shows an in-chat
   *  upgrade prompt. Null when the user has budget. */
  quotaUpgradeUrl?: string | null;
  onClearQuota?: () => void;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function ChatLayout({
  plate,
  lang,
  initialSessionId,
  quotaUpgradeUrl,
  onClearQuota,
}: ChatLayoutProps) {
  const t = useT();
  const navigate = useNavigate();
  const { idToken, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<LocalChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() =>
    initialSessionId ?? generateId(),
  );
  const [resumeThread] = useState(() => Boolean(initialSessionId));
  const [hasMessages, setHasMessages] = useState(false);
  const [sessionTitleSaved, setSessionTitleSaved] = useState<Set<string>>(
    () => new Set(),
  );
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);
  // Bumped on each completed run so the header credit meter refetches balances.
  const [creditRefresh, setCreditRefresh] = useState(0);
  const pretty = plate ? prettyPlate(plate.toUpperCase()) : null;
  const plateKey = plate ? normalizePlate(plate) : null;

  // Header title shows the car being discussed ("Renault Clio · 2017") rather
  // than the generic app name. We read it from the dossier cache the user
  // already populated on the voertuig page - no extra fetch. Falls back to the
  // generic title when the plate isn't cached (e.g. deep-linked /v2/chat).
  const [carLabel, setCarLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!plate) {
      setCarLabel(null);
      return;
    }
    let cancelled = false;
    getCached(plate)
      .then((d) => {
        if (cancelled || !d?.found || !d.algemeen) return;
        const name = [d.algemeen.merk, d.algemeen.model].filter(Boolean).join(" ");
        const year = d.algemeen.datumEersteToelating?.slice(0, 4);
        const label = [name, year].filter(Boolean).join(" · ");
        if (label) setCarLabel(label);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [plate]);

  // Reload scoped sessions and active thread when auth scope changes (fixes
  // anon scope on cold start and stale session id after account switch).
  //
  // Session selection is plate-aware: arriving with a ?plate= must resume the
  // chat for *that* car (or start a fresh one), never whichever conversation
  // happens to be most recent - otherwise a new car opened the previous car's
  // thread, and the agent answered about the wrong vehicle.
  useEffect(() => {
    const stored = loadLocalChatSessions();
    setSessions(stored);
    if (initialSessionId) {
      setCurrentSessionId(initialSessionId);
    } else if (plateKey) {
      const match = stored.find((s) => s.plate && normalizePlate(s.plate) === plateKey);
      setCurrentSessionId(match ? match.id : generateId());
    } else {
      setCurrentSessionId(stored.length > 0 ? stored[0].id : generateId());
    }
    setHasMessages(false);
    setSessionTitleSaved(new Set());
  }, [user?.uid, initialSessionId, plateKey]);

  // Merge server-side threads (cross-device, per-user) with the locally-titled
  // sessions. Local titles win; server-only threads appear with a generic
  // title so a chat started on another device is still selectable here.
  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    (async () => {
      const serverIds = await listThreads(idToken);
      if (cancelled || serverIds.length === 0) return;
      setSessions((prev) => {
        const known = new Set(prev.map((s) => s.id));
        const extra = serverIds
          .filter((id) => !known.has(id))
          .map<LocalChatSession>((id) => ({
            id,
            title: lang === "nl" ? "Eerder gesprek" : "Previous chat",
            createdAt: new Date().toISOString(),
          }));
        if (extra.length === 0) return prev;
        const merged = [...prev, ...extra];
        saveLocalChatSessions(merged);
        return merged;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [idToken, lang]);

  useEffect(() => {
    if (!initialSessionId) return;
    setSessions((prev) => {
      if (prev.some((s) => s.id === initialSessionId)) return prev;
      const untitled = lang === "nl" ? "Eerder gesprek" : "Previous chat";
      const merged = [
        { id: initialSessionId, title: untitled, createdAt: new Date().toISOString() },
        ...prev,
      ];
      saveLocalChatSessions(merged);
      return merged;
    });
  }, [initialSessionId, lang]);

  // On first message for current session, save a session entry
  const handleHasMessages = useCallback(
    (has: boolean) => {
      setHasMessages(has);
      if (has && !sessionTitleSaved.has(currentSessionId)) {
        // We don't have the first message text here; will be set from ChatMessages
        // For now, mark session as needing save - actual title is set after first message
      }
    },
    [currentSessionId, sessionTitleSaved]
  );

  // Called by ChatMessages when the user sends their first message
  const saveSessionWithTitle = useCallback(
    (title: string) => {
      if (sessionTitleSaved.has(currentSessionId)) return;
      const newSession: LocalChatSession = {
        id: currentSessionId,
        title: title.slice(0, 50),
        createdAt: new Date().toISOString(),
        plate: plateKey ?? undefined,
      };
      setSessions((prev) => {
        // Don't duplicate
        if (prev.some((s) => s.id === currentSessionId)) return prev;
        const updated = [newSession, ...prev];
        saveLocalChatSessions(updated);
        return updated;
      });
      setSessionTitleSaved((prev) => new Set(prev).add(currentSessionId));
    },
    [currentSessionId, sessionTitleSaved, plateKey]
  );

  function handleNewChat() {
    const newId = generateId();
    setCurrentSessionId(newId);
    setHasMessages(false);
    setSidebarOpen(false);
  }

  function handleSelectSession(id: string) {
    setCurrentSessionId(id);
    setSidebarOpen(false);
  }

  async function handleDeleteSession(id: string) {
    if (!idToken) return;
    setDeleteBusy(id);
    try {
      await deleteThread(idToken, id);
      removeLocalChatSession(id);
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveLocalChatSessions(next);
        return next;
      });
      if (id === currentSessionId) {
        handleNewChat();
      }
    } finally {
      setDeleteBusy(null);
    }
  }

  function handleCloseChat() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/dashboard");
  }

  return (
    <div
      className="cv2-layout"
      data-sidebar-open={sidebarOpen ? "true" : "false"}
    >
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onClose={() => setSidebarOpen(false)}
        onDeleteSession={(id) => void handleDeleteSession(id)}
        deleteBusyId={deleteBusy}
        isOpen={sidebarOpen}
        lang={lang}
        canDelete={Boolean(idToken)}
      />

      <div className="cv2-main">
        {/* Chat context header: exit · plate + car title · credits · history.
            The history toggle is hidden on desktop (sidebar is always open);
            see .cv2-sidebar-toggle in chat-v2.css. */}
        <div className="cv2-main-header">
          <button
            type="button"
            className="cv2-close-chat"
            onClick={handleCloseChat}
            aria-label={t("chat.focus.closeAria")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="cv2-main-title-wrap">
            {pretty && (
              <span className="cv2-header-plate">
                <NlPlate value={plate!} size="sm" />
              </span>
            )}
            <span className="cv2-main-title">{carLabel ?? t("chat.focus.title")}</span>
          </div>
          <ChatCreditMeter refreshKey={creditRefresh} />
          <button
            className="cv2-sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            type="button"
            aria-label={t("chat.history.toggle", { n: sessions.length })}
          >
            {hasMessages ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            )}
          </button>
        </div>

        {/* Messages area + input */}
        <ChatMessages
          sessionId={currentSessionId}
          existingThread={
            resumeThread || sessions.some((s) => s.id === currentSessionId)
          }
          plate={plate}
          lang={lang}
          quotaUpgradeUrl={quotaUpgradeUrl}
          onClearQuota={onClearQuota}
          onHasMessages={handleHasMessages}
          onFirstMessage={saveSessionWithTitle}
          onRunComplete={() => setCreditRefresh((n) => n + 1)}
        />
      </div>
    </div>
  );
}
