import "./chat-v2.css";

interface CompareCardProps {
  plates: string[];
  reason?: string;
  lang?: "nl" | "en";
}

function formatPlate(raw: string): string {
  const s = raw.replace(/[\s-]/g, "").toUpperCase();
  if (s.length === 6) return `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4)}`;
  if (s.length === 7) return `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`;
  return s;
}

export function CompareCard({ plates, reason, lang = "nl" }: CompareCardProps) {
  return (
    <div className="cv2-compare-card">
      <div className="cv2-compare-card-header">
        <span className="cv2-compare-icon" aria-hidden="true">⚖️</span>
        <h3>{lang === "nl" ? "Vergelijk voertuigen" : "Compare vehicles"}</h3>
      </div>
      {reason && <p className="cv2-compare-reason">{reason}</p>}
      <div className="cv2-compare-plates">
        {plates.map((p) => (
          <span key={p} className="cv2-compare-plate">
            {formatPlate(p)}
          </span>
        ))}
      </div>
      <a
        href={`/compare?plates=${plates.join(",")}`}
        className="cv2-compare-cta"
      >
        {lang === "nl" ? "Vergelijk nu →" : "Compare now →"}
      </a>
    </div>
  );
}
