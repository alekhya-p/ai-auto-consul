import { useAuth } from "../lib/auth";

/**
 * Tiny inline indicator of who the user is. Three states:
 *   - Firebase not configured       → "dev" badge
 *   - Configured + signed-out       → "guest"
 *   - Configured + signed-in user   → email (or display name)
 *
 * Sign-in / sign-up UI lives on dedicated pages (`/sign-in`, `/sign-up`)
 * - this badge is read-only.
 */
export function AuthBadge() {
  const auth = useAuth();

  if (!auth.enabled) {
    return (
      <span className="auth-badge dev" title="Firebase not configured; agent is using its dev-stub user">
        dev
      </span>
    );
  }
  if (!auth.ready) {
    return <span className="auth-badge loading">…</span>;
  }
  if (!auth.user) {
    return <span className="auth-badge anon">guest</span>;
  }
  return (
    <span className="auth-badge user" title={`uid ${auth.user.uid}`}>
      {auth.user.email ?? auth.user.displayName ?? auth.user.uid.slice(0, 8)}
    </span>
  );
}
