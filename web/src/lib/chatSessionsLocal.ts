import { scopedLocalKey } from "./userScope";

export interface LocalChatSession {
  id: string;
  title: string;
  createdAt: string;
  /** Licence plate this chat is pinned to, normalised (uppercase, no
   *  separators). Lets us resume the right conversation per car instead of
   *  reopening whichever chat happens to be most recent. */
  plate?: string;
}

/** Normalise a plate for comparison: uppercase, strip spaces/dashes. */
export function normalizePlate(plate: string): string {
  return plate.replace(/[\s-]/g, "").toUpperCase();
}

const STORAGE_NAME = "consul_chat_sessions";
const MAX = 20;

function key(): string {
  return scopedLocalKey(STORAGE_NAME);
}

export function loadLocalChatSessions(): LocalChatSession[] {
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return [];
    return JSON.parse(raw) as LocalChatSession[];
  } catch {
    return [];
  }
}

export function saveLocalChatSessions(sessions: LocalChatSession[]): void {
  try {
    localStorage.setItem(key(), JSON.stringify(sessions.slice(0, MAX)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function removeLocalChatSession(id: string): void {
  const next = loadLocalChatSessions().filter((s) => s.id !== id);
  saveLocalChatSessions(next);
}
