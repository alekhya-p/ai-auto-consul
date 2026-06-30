import { useCallback, useEffect, useRef } from "react";
import {
  useAgent,
  useAgentContext,
  useCopilotKit,
  useRenderTool,
  useRenderToolCall,
  UseAgentUpdate,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import { track } from "../../lib/analytics";
import { useAuth } from "../../lib/auth";
import { useT } from "../../lib/i18n";
import { loadThreadMessages } from "./history";
import { ChatInput } from "./ChatInput";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatMarkdown } from "./ChatMarkdown";
import { VehicleDataCard, type VehicleDataCardProps } from "./VehicleDataCard";
import { AnalysisCard, type AnalysisCardProps } from "./AnalysisCard";
import { CompareCard } from "./CompareCard";
import { FollowUpSuggestions } from "./FollowUpSuggestions";
import { SourcesCard, type SourcesCardProps } from "./SourcesCard";
import { UpgradePrompt } from "./UpgradePrompt";
import { filterProseAfterCards, type RenderItem } from "./trimProse";
import { prettyPlate } from "../../lib/voertuigCache";
import "./chat-v2.css";

interface ChatMessagesProps {
  sessionId: string;
  /** Whether this session already exists server-side (known thread) - gates the
   *  history fetch so we don't hit message_snapshot for a brand-new chat
   *  (which 404/500s because the session has no stored messages yet). */
  existingThread?: boolean;
  plate?: string;
  lang: "nl" | "en";
  /** Non-null when the last run was blocked by the quota gate (429). */
  quotaUpgradeUrl?: string | null;
  onClearQuota?: () => void;
  onHasMessages: (has: boolean) => void;
  onFirstMessage?: (title: string) => void;
  /** Fired when a run finishes (isRunning true→false) so the header credit
   *  meter can re-read balances after the turn debits. */
  onRunComplete?: () => void;
}

// AG-UI message shape (v2). Cast once at the agent boundary to dodge the
// union-narrowing friction of the full Message type.
interface UIToolCall {
  id: string;
  function: { name: string; arguments: string };
}
interface UIMessage {
  id: string;
  role: string;
  content?: string;
  toolCalls?: UIToolCall[];
  toolCallId?: string;
}

/** Tool results stream back as JSON strings; parse defensively. */
function parseResult(result: string | undefined): Record<string, unknown> | undefined {
  if (!result) return undefined;
  try {
    return JSON.parse(result) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Collapse the AG-UI message stream into a clean, deduped render list.
 *
 * The agent stream repeats things: the same tool call shows up twice (once with
 * arguments, once empty) and the assistant's final text is echoed across
 * multiple assistant messages. Rendering `agent.messages` verbatim therefore
 * drew every card, every suggestion strip, and the closing text twice. Here we
 * emit each unique tool call once (preferring the copy that actually has
 * arguments) and each unique assistant-text block once, preserving order.
 */
function buildRenderItems(messages: UIMessage[]): RenderItem[] {
  const argLen = (tc?: UIToolCall) => (tc?.function?.arguments ?? "").trim().length;
  const bestToolCall = new Map<string, UIToolCall>();
  for (const m of messages) {
    for (const tc of m.toolCalls ?? []) {
      const prev = bestToolCall.get(tc.id);
      if (!prev || argLen(tc) > argLen(prev)) bestToolCall.set(tc.id, tc);
    }
  }

  const items: RenderItem[] = [];
  const emittedTool = new Set<string>();
  const seenText = new Set<string>();
  for (const m of messages) {
    if (m.role === "user") {
      if (m.content) items.push({ kind: "user", key: m.id || `u${items.length}`, content: m.content });
      continue;
    }
    if (m.role !== "assistant") continue;
    const text = (m.content ?? "").trim();
    if (text && !seenText.has(text)) {
      seenText.add(text);
      items.push({ kind: "text", key: m.id || `t${items.length}`, content: m.content! });
    }
    for (const tc of m.toolCalls ?? []) {
      if (!tc.id || emittedTool.has(tc.id)) continue;
      emittedTool.add(tc.id);
      const best = bestToolCall.get(tc.id) ?? tc;
      const toolMessage = messages.find((x) => x.role === "tool" && x.toolCallId === tc.id);
      items.push({ kind: "tool", key: tc.id, toolCall: best, toolMessage });
    }
  }
  return items;
}

export function ChatMessages({
  sessionId,
  existingThread = false,
  plate,
  lang,
  quotaUpgradeUrl,
  onClearQuota,
  onHasMessages,
  onFirstMessage,
  onRunComplete,
}: ChatMessagesProps) {
  const t = useT();
  const firstMessageFiredRef = useRef(false);
  const { idToken } = useAuth();
  // Read latest existing-thread flag inside the session effect WITHOUT making it
  // a dependency - otherwise saving the first message (which flips this true)
  // would re-run the effect and wipe the in-flight conversation.
  const existingThreadRef = useRef(existingThread);
  existingThreadRef.current = existingThread;
  const { agent } = useAgent({
    agentId: "default",
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged],
  });
  const { copilotkit } = useCopilotKit();
  const renderToolCall = useRenderToolCall();

  // ─── Bind the agent's threadId to the sidebar session, and reload that
  //     thread's server-stored messages. This is what makes history actually
  //     load: the agent persists each run under threadId in Firestore, so
  //     selecting a past chat (new sessionId) rebinds + replays it. A brand-new
  //     session loads as empty. firstMessageFiredRef resets so the new thread
  //     can save its title. ───
  useEffect(() => {
    agent.threadId = sessionId;
    firstMessageFiredRef.current = false;
    let cancelled = false;
    (async () => {
      const msgs = existingThreadRef.current
        ? await loadThreadMessages(idToken, sessionId)
        : [];
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agent.setMessages(msgs as any);
      if (msgs.length > 0) firstMessageFiredRef.current = true; // existing thread already titled
    })();
    return () => {
      cancelled = true;
    };
    // agent identity is stable for the provider lifetime; rebind on session change.
  }, [sessionId, idToken, agent]);

  // Push the pinned plate + UI language to every agent run (replaces v1
  // useCopilotReadable). The agent's instruction pins the plate from here.
  useAgentContext({ description: "Current vehicle plate", value: plate ?? "none" });
  useAgentContext({ description: "UI language", value: lang });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const messages = (agent.messages ?? []) as unknown as UIMessage[];
  const isRunning = agent.isRunning;

  const sendMessage = useCallback(
    (content: string) => {
      onClearQuota?.(); // optimistic: hide the upgrade prompt; re-shows if still blocked
      track("chat_message_sent");
      if (!firstMessageFiredRef.current && onFirstMessage) {
        firstMessageFiredRef.current = true;
        onFirstMessage(content);
      }
      agent.addMessage({ id: crypto.randomUUID(), role: "user", content });
      void copilotkit.runAgent({ agent });
    },
    [agent, copilotkit, onFirstMessage, onClearQuota],
  );

  // ─── Tool render registrations (v2). Agent-side tools: render only, no
  //     handler. `result` arrives as a JSON string at status "complete".
  //     NOTE: names MUST match the ADK function-tool names exactly - they are
  //     snake_case (rdw_fetch, …), not camelCase. A mismatch means CopilotKit
  //     finds no renderer and dumps the raw tool call instead of the card. ───
  useRenderTool(
    {
      name: "rdw_fetch",
      parameters: z.object({ plate: z.string() }),
      render: ({ status, parameters, result }) => {
        const data = parseResult(result);
        if (status !== "complete") return <VehicleDataCard loading plate={parameters?.plate} lang={lang} />;
        if (data && data.found === false) {
          return (
            <VehicleDataCard
              error={typeof data.error === "string" ? data.error : undefined}
              plate={parameters?.plate}
              lang={lang}
            />
          );
        }
        return <VehicleDataCard data={data as VehicleDataCardProps["data"]} plate={parameters?.plate} lang={lang} />;
      },
    },
    [lang],
  );

  useRenderTool(
    {
      name: "ai_analysis_fetch",
      parameters: z.object({ plate: z.string(), lang: z.string().optional(), deep: z.boolean().optional() }),
      render: ({ status, parameters, result }) => {
        const data = parseResult(result);
        const analysisPlate = parameters?.plate;
        if (status !== "complete") return <AnalysisCard loading plate={analysisPlate} lang={lang} />;
        if (data && (data.found === false || (typeof data.error === "string" && !data.summary))) {
          return (
            <AnalysisCard
              error={typeof data.error === "string" ? data.error : undefined}
              plate={analysisPlate}
              lang={lang}
            />
          );
        }
        return (
          <AnalysisCard
            data={data as AnalysisCardProps["data"]}
            plate={analysisPlate}
            lang={lang}
            onRequestDeep={
              analysisPlate
                ? () =>
                    sendMessage(
                      lang === "en"
                        ? `Give me the full, in-depth analysis for ${analysisPlate}.`
                        : `Geef de volledige, uitgebreide analyse voor ${analysisPlate}.`,
                    )
                : undefined
            }
          />
        );
      },
    },
    [lang, sendMessage],
  );

  useRenderTool(
    {
      name: "web_search",
      parameters: z.object({ query: z.string(), lang: z.string().optional() }),
      render: ({ status, parameters, result }) => {
        const data = parseResult(result);
        if (status !== "complete") return <SourcesCard loading query={parameters?.query} lang={lang} />;
        return <SourcesCard data={data as SourcesCardProps["data"]} query={parameters?.query} lang={lang} />;
      },
    },
    [lang],
  );

  useRenderTool(
    {
      name: "suggest_compare",
      parameters: z.object({ plates: z.array(z.string()), reason: z.string().optional() }),
      render: ({ parameters }) => (
        <CompareCard plates={parameters?.plates ?? []} reason={parameters?.reason} lang={lang} />
      ),
    },
    [lang],
  );

  useRenderTool(
    {
      name: "suggest_followups",
      parameters: z.object({ questions: z.array(z.string()) }),
      render: ({ parameters }) => (
        <FollowUpSuggestions
          questions={parameters?.questions ?? []}
          onSelect={(question) => sendMessage(question)}
        />
      ),
    },
    [sendMessage],
  );

  const renderItems = filterProseAfterCards(buildRenderItems(messages) as RenderItem[]);
  const hasContent = messages.some((m) => m.role === "user" || m.role === "assistant");

  useEffect(() => {
    onHasMessages(hasContent);
  }, [hasContent, onHasMessages]);

  // Engagement: chat surface opened (once per mount).
  useEffect(() => {
    track("chat_opened", { has_plate: Boolean(plate) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire onRunComplete on the isRunning true→false edge. By the time the run
  // ends the server has debited the turn, so this is when the header meter
  // should re-read balances.
  const wasRunningRef = useRef(false);
  useEffect(() => {
    if (wasRunningRef.current && !isRunning) onRunComplete?.();
    wasRunningRef.current = isRunning;
  }, [isRunning, onRunComplete]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, isRunning]);

  if (!hasContent && !isRunning) {
    return (
      <div className="cv2-messages-wrapper">
        {quotaUpgradeUrl && (
          <div className="cv2-messages-area">
            <UpgradePrompt lang={lang} upgradeUrl={quotaUpgradeUrl} />
          </div>
        )}
        <ChatEmptyState onSend={sendMessage} lang={lang} plate={plate} />
      </div>
    );
  }

  return (
    <div className="cv2-messages-wrapper">
      <div className="cv2-messages-area" ref={scrollAreaRef}>
        {renderItems.map((item) => {
          if (item.kind === "user") {
            return (
              <div key={item.key} className="cv2-msg cv2-msg-user">
                <div>{item.content}</div>
              </div>
            );
          }
          if (item.kind === "text") {
            return (
              <div key={item.key} className="cv2-msg cv2-msg-assistant">
                <ChatMarkdown content={item.content} />
              </div>
            );
          }
          // kind === "tool"
          return (
            <div key={item.key} className="cv2-msg cv2-msg-action">
              {renderToolCall({
                toolCall: item.toolCall,
                toolMessage: item.toolMessage,
              } as unknown as Parameters<typeof renderToolCall>[0])}
            </div>
          );
        })}

        {isRunning && (
          <div className="cv2-typing" aria-label="Aan het typen…">
            <span /><span /><span />
          </div>
        )}

        {quotaUpgradeUrl && !isRunning && (
          <UpgradePrompt lang={lang} upgradeUrl={quotaUpgradeUrl} />
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={sendMessage}
        isLoading={isRunning}
        onStop={() => agent.abortRun()}
        lang={lang}
        placeholder={
          plate
            ? t("chat.composer.placeholderPlate", { plate: prettyPlate(plate.toUpperCase()) })
            : undefined
        }
      />
    </div>
  );
}
