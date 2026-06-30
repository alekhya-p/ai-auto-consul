/**
 * Server-side chat history helpers.
 *
 * The Python agent (adk-agui-middleware) persists each thread's messages in
 * Firestore, keyed by (app, uid, thread_id). The agent's `threadId` is bound to
 * the sidebar session id (see ChatMessages), so these endpoints let us list a
 * user's past threads and reload a thread's messages on the client.
 *
 * Endpoints (same-origin, behind the Firebase Hosting rewrite → Cloud Run):
 *   GET /v2/agent/thread/list                  → [{ threadId }]
 *   GET /v2/agent/message_snapshot/{threadId}  → { messages: Message[] }
 */

function authHeaders(idToken: string | null): HeadersInit {
  if (!idToken) return {};
  return { Authorization: `Bearer ${idToken}` };
}

/** List the signed-in user's thread ids (newest-first is not guaranteed). */
export async function listThreads(idToken: string): Promise<string[]> {
  try {
    const res = await fetch("/v2/agent/thread/list", { headers: authHeaders(idToken) });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .map((t) => (typeof t === "string" ? t : (t as { threadId?: string })?.threadId))
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

/**
 * Load a thread's stored messages. Returns `[]` for a new/unknown thread (the
 * snapshot endpoint 404s when the session doesn't exist yet) so callers can
 * treat "new chat" and "empty history" identically.
 */
/** Delete one persisted thread (server + caller clears local list). */
export async function deleteThread(idToken: string, threadId: string): Promise<boolean> {
  try {
    const res = await fetch(`/v2/agent/thread/${encodeURIComponent(threadId)}`, {
      method: "DELETE",
      headers: authHeaders(idToken),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadThreadMessages(
  idToken: string | null,
  threadId: string,
): Promise<unknown[]> {
  try {
    const res = await fetch(`/v2/agent/message_snapshot/${encodeURIComponent(threadId)}`, {
      headers: authHeaders(idToken),
    });
    if (!res.ok) return [];
    const snap = (await res.json()) as { messages?: unknown[] };
    return Array.isArray(snap?.messages) ? snap.messages : [];
  } catch {
    return [];
  }
}
