import { useCallback, useMemo, useState } from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { HttpAgent } from "@ag-ui/client";
import "./chat-v2.css";
import { useAuth } from "../../lib/auth";
import { ChatLayout } from "./ChatLayout";

/** Pull the upgradeUrl out of a quota-gate (429 chat_turns_exhausted) error. */
function parseQuotaError(error: unknown): { upgradeUrl: string } | null {
  const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!/chat_turns_exhausted|daily_limit|HTTP 429/i.test(msg)) return null;
  const m = msg.match(/"upgradeUrl"\s*:\s*"([^"]+)"/);
  return { upgradeUrl: m?.[1] ?? "/prijzen" };
}

interface Props {
  plate?: string;
  lang?: "nl" | "en";
  /** Open a stored thread (e.g. from /account or ?session=). */
  initialSessionId?: string;
}

export function ConsulCopilotChat({ plate, lang = "nl", initialSessionId }: Props) {
  const { idToken } = useAuth();
  const agent = useMemo(() => new HttpAgent({ url: "/v2/agent" }), []);
  const headers = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (idToken) h.Authorization = `Bearer ${idToken}`;
    return h;
  }, [idToken]);

  const [quotaUpgradeUrl, setQuotaUpgradeUrl] = useState<string | null>(null);
  const clearQuota = useCallback(() => setQuotaUpgradeUrl(null), []);

  return (
    <CopilotKitProvider
      runtimeUrl="/v2/agent"
      headers={headers}
      agents__unsafe_dev_only={{ default: agent }}
      onError={({ code, error, context }) => {
        const quota = parseQuotaError(error);
        if (quota) {
          setQuotaUpgradeUrl(quota.upgradeUrl);
          return;
        }
        // eslint-disable-next-line no-console
        console.error("[copilotkit]", code, error, context);
      }}
    >
      <ChatLayout
        plate={plate}
        lang={lang}
        initialSessionId={initialSessionId}
        quotaUpgradeUrl={quotaUpgradeUrl}
        onClearQuota={clearQuota}
      />
    </CopilotKitProvider>
  );
}
