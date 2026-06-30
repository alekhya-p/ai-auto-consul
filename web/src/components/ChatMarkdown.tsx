import { Fragment, type ReactNode } from "react";

/**
 * Tiny markdown renderer for chat messages.
 *
 * Handles the formatting Claude actually emits in chat: paragraph breaks,
 * bullet/numbered lists, **bold**, *italic*, and `inline code`. Deliberately
 * NOT a full markdown parser - no headings, no images, no raw HTML, no
 * tables. That keeps the surface tight and avoids dragging in a 50 KB
 * dependency for output we control.
 *
 * Everything renders through React nodes (no dangerouslySetInnerHTML) so
 * the XSS surface is the same as plain text.
 */
export function ChatMarkdown({ text }: { text: string }) {
  if (!text) return null;
  const blocks = parseBlocks(text);
  return (
    <>
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </>
  );
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paraBuf: string[] = [];
  let listBuf: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (paraBuf.length > 0) {
      blocks.push({ kind: "p", text: paraBuf.join(" ") });
      paraBuf = [];
    }
  };
  const flushList = () => {
    if (listBuf) {
      blocks.push(listBuf);
      listBuf = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushPara();
      flushList();
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+\.\s+(.+)$/.exec(line);
    if (bullet) {
      flushPara();
      if (!listBuf || listBuf.kind !== "ul") {
        flushList();
        listBuf = { kind: "ul", items: [] };
      }
      listBuf.items.push(bullet[1]);
      continue;
    }
    if (numbered) {
      flushPara();
      if (!listBuf || listBuf.kind !== "ol") {
        flushList();
        listBuf = { kind: "ol", items: [] };
      }
      listBuf.items.push(numbered[1]);
      continue;
    }
    flushList();
    paraBuf.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

function Block({ block }: { block: Block }) {
  switch (block.kind) {
    case "p":  return <p>{renderInline(block.text)}</p>;
    case "ul": return <ul>{block.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}</ul>;
    case "ol": return <ol>{block.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}</ol>;
  }
}

/**
 * Inline markdown: **bold**, *italic*, `code`. Applied in that order so a
 * `**foo**` doesn't get eaten by the `*foo*` rule. Anything that doesn't
 * match remains plain text.
 */
function renderInline(text: string): ReactNode {
  // Tokenise into [text|bold|italic|code] runs by scanning left-to-right.
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        out.push(<strong key={key++}>{text.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && end !== i + 1) {
        out.push(<em key={key++}>{text.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1 && end !== i + 1) {
        out.push(<code key={key++}>{text.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }
    // Plain run: take everything until the next markdown sentinel.
    const nextSentinel = findNext(text, i + 1, ["**", "*", "`"]);
    out.push(<Fragment key={key++}>{text.slice(i, nextSentinel)}</Fragment>);
    i = nextSentinel;
  }
  return out;
}

function findNext(text: string, from: number, needles: string[]): number {
  let best = text.length;
  for (const n of needles) {
    const idx = text.indexOf(n, from);
    if (idx !== -1 && idx < best) best = idx;
  }
  return best;
}
