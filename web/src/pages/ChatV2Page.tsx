import { useSearchParams } from "react-router-dom";
import { useI18n } from "../lib/i18n.js";
import { ConsulCopilotChat } from "../features/chat-v2/index.js";

/**
 * /v2/chat - CopilotKit-powered generative UI chat with custom Gemini-style layout.
 * Accepts ?plate=XX-XX-XX to pre-seed the vehicle context.
 * The layout (sidebar + messages + input) is owned by ConsulCopilotChat.
 */
export function ChatV2Page() {
  const [params] = useSearchParams();
  const plate = params.get("plate") || undefined;
  const session = params.get("session") || undefined;
  const { lang } = useI18n();

  return (
    <div
      className="chat-v2-page"
      style={{ flex: 1, minHeight: 0 }}
    >
      <ConsulCopilotChat plate={plate} lang={lang} initialSessionId={session} />
    </div>
  );
}
