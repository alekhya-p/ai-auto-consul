import "./chat-v2.css";

interface FollowUpSuggestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export function FollowUpSuggestions({ questions, onSelect }: FollowUpSuggestionsProps) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="cv2-followup-strip">
      <span className="cv2-followup-label" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6" /><path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>
      </span>
      {questions.map((q, i) => (
        <button
          key={i}
          className="cv2-followup-chip"
          onClick={() => onSelect(q)}
          type="button"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
