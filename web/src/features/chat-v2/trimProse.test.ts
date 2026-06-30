import { describe, expect, it } from "vitest";
import { filterProseAfterCards, type RenderItem } from "./trimProse";

describe("filterProseAfterCards", () => {
  it("drops long prose immediately after a card tool", () => {
    const items: RenderItem[] = [
      {
        kind: "tool",
        key: "t1",
        toolCall: { id: "t1", function: { name: "rdw_fetch", arguments: "{}" } },
      },
      {
        kind: "text",
        key: "x1",
        content:
          "Here is a very long repetition of everything already visible in the vehicle card above, including make model and APK dates that the user can read directly.",
      },
    ];
    expect(filterProseAfterCards(items)).toHaveLength(1);
  });

  it("keeps short prose after a card", () => {
    const items: RenderItem[] = [
      {
        kind: "tool",
        key: "t1",
        toolCall: { id: "t1", function: { name: "rdw_fetch", arguments: "{}" } },
      },
      { kind: "text", key: "x1", content: "Worth checking the APK comment." },
    ];
    expect(filterProseAfterCards(items)).toHaveLength(2);
  });
});
