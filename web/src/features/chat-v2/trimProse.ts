/** Tool calls that render structured cards - prose after them is usually redundant. */
const CARD_TOOLS = new Set([
  "rdw_fetch",
  "ai_analysis_fetch",
  "web_search",
  "suggest_compare",
]);

export type RenderItem =
  | { kind: "user"; key: string; content: string }
  | { kind: "text"; key: string; content: string }
  | {
      kind: "tool";
      key: string;
      toolCall: { id: string; function: { name: string; arguments: string } };
      toolMessage?: unknown;
    };

/** Drop assistant markdown blocks that repeat what a preceding card already showed. */
export function filterProseAfterCards(items: RenderItem[]): RenderItem[] {
  return items.filter((item, index) => {
    if (item.kind !== "text") return true;
    return !shouldSkipProse(items, index);
  });
}

function shouldSkipProse(items: RenderItem[], index: number): boolean {
  const text = items[index];
  if (text.kind !== "text") return false;
  const content = text.content.trim();
  if (content.length < 80) return false;

  for (let i = index - 1; i >= 0 && i >= index - 4; i--) {
    const prev = items[i];
    if (prev.kind === "user") break;
    if (prev.kind === "tool") {
      const name = prev.toolCall.function?.name;
      if (name && CARD_TOOLS.has(name)) return true;
      break;
    }
    if (prev.kind === "text") break;
  }
  return false;
}
