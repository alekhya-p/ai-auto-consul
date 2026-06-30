import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

/**
 * Route guard for admin-only pages. Renders children only for a signed-in
 * user carrying the `admin` custom claim; everyone else is redirected to
 * /dashboard. Real enforcement is server-side (the endpoint returns 403) -
 * this just hides the UI.
 *
 * When Firebase isn't configured (local dev) the dev-stub user is NOT admin,
 * so the route stays hidden unless a real admin claim is present.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.enabled && !auth.ready) return null;
  if (!auth.isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
