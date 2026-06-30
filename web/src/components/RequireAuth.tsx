import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { RouteLoadingShell } from "./RouteLoadingShell";

/**
 * Route guard. Children render only when a non-anonymous user is signed
 * in. Signed-out visitors are redirected to `/sign-in?next=<current path>`
 * so they land back here after authenticating.
 *
 * If Firebase isn't configured (local dev), children render - the agent's
 * dev-stub user provides authorization downstream.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.enabled) return <>{children}</>;
  if (!auth.ready) return <RouteLoadingShell pathname={location.pathname} />;
  if (!auth.user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }
  return <>{children}</>;
}
