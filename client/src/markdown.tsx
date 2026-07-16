import type { ReactNode } from "react";

// Deliberately not using dangerouslySetInnerHTML — this builds React
// elements directly, so there's no HTML-injection surface even though the
// text comes from a local LLM we don't otherwise sanitize.
const TOKEN_RE = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;

/** Renders **bold**, *italic roleplay actions*, and `code` spans; preserves raw newlines. */
export function renderMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const re = new RegExp(TOKEN_RE);
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    const [, bold, italic, code] = match;
    if (bold !== undefined) {
      nodes.push(<strong key={key++}>{bold}</strong>);
    } else if (italic !== undefined) {
      nodes.push(
        <em key={key++} className="rp-action">
          {italic}
        </em>
      );
    } else if (code !== undefined) {
      nodes.push(<code key={key++}>{code}</code>);
    }

    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return nodes;
}
