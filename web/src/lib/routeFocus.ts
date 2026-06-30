/** Routes that use a full-viewport product shell (no marketing header/footer/bottom nav). */
export function isChatFocusRoute(pathname: string): boolean {
  return pathname === "/v2/chat" || pathname.startsWith("/v2/chat/");
}
