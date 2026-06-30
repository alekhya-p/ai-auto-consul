import { isChatFocusRoute } from "../lib/routeFocus";
import "../features/chat-v2/chat-v2.css";

/**
 * Non-blank placeholder while Firebase auth resolves on gated routes.
 * Chat routes get a layout-shaped shell so navigation never flashes white.
 */
export function RouteLoadingShell({ pathname }: { pathname: string }) {
  if (isChatFocusRoute(pathname)) {
    return (
      <div className="chat-v2-page route-loading-chat" aria-busy="true" aria-live="polite">
        <div className="cv2-layout">
          <aside className="cv2-sidebar cv2-route-loading-sidebar" aria-hidden="true">
            <div className="route-loading-bar route-loading-bar--wide" />
            <div className="route-loading-bar route-loading-bar--medium" />
          </aside>
          <div className="cv2-main">
            <div className="cv2-main-header cv2-route-loading-header">
              <div className="route-loading-bar route-loading-bar--short" />
              <div className="route-loading-bar route-loading-bar--title" />
            </div>
            <div className="cv2-route-loading-body">
              <div className="route-loading-bar route-loading-bar--bubble" />
              <div className="route-loading-card" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="route-loading-shell" aria-busy="true" aria-live="polite">
      <div className="route-loading-pulse" />
    </div>
  );
}
