/**
 * Namespaces browser storage per visitor: anonymous vs signed-in uid.
 * Prevents chat history / recent plates from leaking across accounts on
 * the same device (GDPR-relevant).
 */

const LEGACY_CHAT_SESSIONS = "consul_chat_sessions";

let activeScope = "anon";

/** `anon` for signed-out; `u:<firebaseUid>` when signed in. */
export function userStorageScope(uid: string | null | undefined): string {
  return uid ? `u:${uid}` : "anon";
}

export function getActiveStorageScope(): string {
  return activeScope;
}

export function setActiveStorageScope(uid: string | null | undefined): void {
  activeScope = userStorageScope(uid);
}

export function scopedLocalKey(name: string): string {
  return `${getActiveStorageScope()}:${name}`;
}

/**
 * Drop unscoped keys that could belong to another account. We do not
 * re-assign legacy chat sessions to the current user (too risky).
 */
export function purgeLegacyGlobalKeys(): void {
  try {
    localStorage.removeItem(LEGACY_CHAT_SESSIONS);
  } catch {
    /* ignore */
  }
}

/** Call when Firebase uid changes (sign-in, sign-out, account switch). */
export function handleAuthUidChange(nextUid: string | null | undefined): void {
  purgeLegacyGlobalKeys();
  setActiveStorageScope(nextUid);
}
