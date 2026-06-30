import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import "./chat-v2.css";

/**
 * Renders assistant prose as GitHub-flavored Markdown using the shared
 * `.cv2-markdown` styles. Replaces the old hand-rolled paragraph splitter that
 * leaked raw `*`, `[text](url)`, `#`, etc. when the model used those for
 * emphasis, links, or headings.
 *
 * Links always open in a new tab with safe rel attrs; everything else inherits
 * the chat typography from chat-v2.css.
 */
const components: Components = {
  a: ({ href, children, ...rest }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  ),
};

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="cv2-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
