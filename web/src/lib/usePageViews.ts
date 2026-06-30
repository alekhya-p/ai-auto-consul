import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { track } from "./analytics";

/**
 * Emits a GA4 `page_view` on every React Router location change. GA4's auto
 * page_view only fires once for an SPA, so we send it manually per route.
 * Mount once inside the Router. No-op until analytics is configured + consented.
 */
export function usePageViews(): void {
  const loc = useLocation();
  useEffect(() => {
    track("page_view", { page_path: loc.pathname + loc.search });
  }, [loc.pathname, loc.search]);
}
