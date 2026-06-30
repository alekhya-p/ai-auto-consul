/** Maps ledger ``toolName`` codes to human-readable account usage labels. */
const TOOL_LABEL_KEYS: Record<string, string> = {
  ai_analysis_lite: "account.usage.tool.aiAnalysisLite",
  ai_analysis_deep: "account.usage.tool.aiAnalysisDeep",
  "rdw.fetch": "account.usage.tool.rdwFetch",
  rdw_fetch: "account.usage.tool.rdwFetch",
  web_search: "account.usage.tool.webSearch",
  suggest_compare: "account.usage.tool.suggestCompare",
  suggest_followups: "account.usage.tool.suggestFollowups",
  chat_turn: "account.usage.tool.chatTurn",
};

export function usageToolLabel(
  toolName: string,
  t: (key: string) => string,
): string {
  const key = TOOL_LABEL_KEYS[toolName];
  if (key) {
    const label = t(key);
    if (label !== key) return label;
  }
  return toolName;
}

/** Sort passes for display: soonest expiry first (matches FIFO consumption). */
export function sortPassesFifo<T extends { expiresAt: string }>(passes: T[]): T[] {
  return [...passes].sort(
    (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
  );
}
