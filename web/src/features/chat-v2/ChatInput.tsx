import { useEffect, useRef, useState } from "react";
import { useT } from "../../lib/i18n";
import "./chat-v2.css";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  lang: "nl" | "en";
  placeholder?: string;
}

export function ChatInput({ onSend, isLoading, onStop, lang: _lang, placeholder }: ChatInputProps) {
  const t = useT();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const defaultPlaceholder = placeholder ?? t("chat.composer.placeholder");

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  return (
    <div className="cv2-input-container">
      <div className="cv2-input-card">
        <textarea
          ref={textareaRef}
          className="cv2-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={defaultPlaceholder}
          rows={1}
          aria-label={t("chat.composer.label")}
          autoComplete="off"
          autoCorrect="on"
          spellCheck
        />
        <div className="cv2-input-actions">
          {isLoading ? (
            <button
              className="cv2-stop-btn"
              onClick={onStop}
              aria-label={t("chat.composer.stop")}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              className="cv2-send-btn"
              onClick={handleSend}
              disabled={!text.trim()}
              aria-label={t("chat.composer.send")}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
