/**
 * Markdown-lite for copilot answers (pure, unit tested). Supports paragraphs, "- " / "* " / "• "
 * bullets, "1. " numbered lines, "#" headings (shown as bold lines), **bold** and `code`.
 * Produces plain data; the drawer renders it as React text nodes (never HTML).
 */
export type Inline = { text: string; bold?: boolean; code?: boolean };
export type MdList = { kind: "ul"; items: Inline[][] } | { kind: "ol"; items: Inline[][] };
export type MdBlock = { kind: "p"; inline: Inline[] } | { kind: "h"; inline: Inline[] } | MdList;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else out.push({ text: m[2]!, code: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text: "" }];
}

export function parseMarkdownLite(input: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  const cur: { list: MdList | null } = { list: null };
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", inline: parseInline(para.join("\n")) });
    para = [];
  };
  const flushList = () => {
    if (cur.list) blocks.push(cur.list);
    cur.list = null;
  };
  for (const raw of input.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d{1,2}[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const kind = bullet ? "ul" : "ol";
      if (cur.list && cur.list.kind !== kind) flushList();
      const list: MdList = cur.list ?? { kind, items: [] };
      list.items.push(parseInline((bullet ?? numbered)![1]!));
      cur.list = list;
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push({ kind: "h", inline: parseInline(heading[1]!.replace(/\*\*/g, "")) });
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}
