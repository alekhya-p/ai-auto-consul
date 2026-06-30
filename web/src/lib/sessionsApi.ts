import { fetchAppCheckToken, fetchIdToken } from "./auth";
import type { components } from "./api-types.gen";

export type SessionResponse = components["schemas"]["SessionResponse"];
export type SessionSummary = components["schemas"]["SessionSummary"];
export type SessionListResponse = components["schemas"]["SessionListResponse"];

export class SessionFetchError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

/**
 * Fetch a single session (metadata + turns) from the agent. The endpoint
 * already enforces auth + ownership; the client just attaches the bearer
 * + App Check tokens.
 */
export async function fetchSession(sessionId: string, signal?: AbortSignal): Promise<SessionResponse> {
  const headers = new Headers();
  const [idToken, appCheckToken] = await Promise.all([fetchIdToken(), fetchAppCheckToken()]);
  if (idToken) headers.set("Authorization", `Bearer ${idToken}`);
  if (appCheckToken) headers.set("X-Firebase-AppCheck", appCheckToken);

  const res = await fetch(`/v1/sessions/${encodeURIComponent(sessionId)}`, { headers, signal });
  if (res.status === 401) throw new SessionFetchError("Sign in to see this chat.", 401);
  if (res.status === 403) throw new SessionFetchError("Not your chat.", 403);
  if (res.status === 404) throw new SessionFetchError("Chat not found.", 404);
  if (!res.ok) throw new SessionFetchError(`Failed (${res.status})`, res.status);
  return (await res.json()) as SessionResponse;
}

/** List recent chat sessions for the signed-in user. */
export async function listSessions(limit = 20, signal?: AbortSignal): Promise<SessionSummary[]> {
  const headers = new Headers();
  const [idToken, appCheckToken] = await Promise.all([fetchIdToken(), fetchAppCheckToken()]);
  if (idToken) headers.set("Authorization", `Bearer ${idToken}`);
  if (appCheckToken) headers.set("X-Firebase-AppCheck", appCheckToken);

  const res = await fetch(`/v1/sessions?limit=${limit}`, { headers, signal });
  if (res.status === 401) throw new SessionFetchError("Sign in to see chats.", 401);
  if (!res.ok) throw new SessionFetchError(`Failed (${res.status})`, res.status);
  const body = (await res.json()) as SessionListResponse;
  return body.sessions ?? [];
}
