import { ChatInput } from "./ChatInput";
import { useT, useTList } from "../../lib/i18n";
import { prettyPlate } from "../../lib/voertuigCache";
import "./chat-v2.css";

interface ChatEmptyStateProps {
  onSend: (text: string) => void;
  lang: "nl" | "en";
  plate?: string;
}

export function ChatEmptyState({ onSend, lang, plate }: ChatEmptyStateProps) {
  const t = useT();
  const tList = useTList();
  const pretty = plate ? prettyPlate(plate.toUpperCase()) : null;
  const suggestions = pretty
    ? ([0, 1, 2, 3] as const).map((i) =>
        t(`chat.suggestionsForPlate.${i}`, { plate: pretty }),
      )
    : tList("chat.suggestions");

  return (
    <div className="cv2-empty">
      <div className="cv2-empty-icon" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="23" stroke="var(--line)" strokeWidth="2" />
          <path
            d="M14 28l2-8h16l2 8H14z"
            fill="var(--navy)"
            opacity="0.15"
          />
          <rect x="10" y="28" width="28" height="7" rx="3.5" fill="var(--navy)" opacity="0.2" />
          <circle cx="17" cy="35" r="3" fill="var(--navy)" opacity="0.5" />
          <circle cx="31" cy="35" r="3" fill="var(--navy)" opacity="0.5" />
          <path
            d="M24 16l1.5 3h3.5l-2.5 2 1 3-3.5-2-3.5 2 1-3-2.5-2h3.5L24 16z"
            fill="var(--teal)"
            opacity="0.7"
          />
        </svg>
      </div>
      <h2 className="cv2-empty-title">{t("chat.empty.title")}</h2>
      <p className="cv2-empty-subtitle">
        {pretty ? t("chat.empty.bodyPlate", { plate: pretty }) : t("chat.empty.body")}
      </p>
      <div className="cv2-suggestions">
        {suggestions.map((s, i) => (
          <button
            key={i}
            className="cv2-suggestion-chip"
            onClick={() => onSend(s)}
            type="button"
          >
            {s}
          </button>
        ))}
      </div>
      <ChatInput
        onSend={onSend}
        isLoading={false}
        lang={lang}
        placeholder={pretty ? t("chat.composer.placeholderPlate", { plate: pretty }) : undefined}
      />
    </div>
  );
}
