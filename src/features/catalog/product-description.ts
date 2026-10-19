/**
 * Product descriptions are deliberately stored as plain text. These blocks mirror the
 * storefront formatter so the dashboard preview helps a seller author what shoppers see
 * without ever accepting or rendering HTML.
 */
export type ProductDescriptionBlock = { kind: "p" | "h"; text: string } | { kind: "ul"; items: string[] };

export function parseProductDescription(input: string): ProductDescriptionBlock[] {
  const lines = input.replace(/\r/g, "").split("\n").map((line) => line.trim());
  const joined: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // A pasted bullet glyph on its own line is commonly followed by the content on the
    // next line. Treat the pair as one bullet instead of showing an empty list item.
    if (/^[•·*-]$/.test(line)) {
      let next = i + 1;
      while (next < lines.length && !lines[next]) next++;
      if (next < lines.length) {
        joined.push(`• ${lines[next]}`);
        i = next;
        continue;
      }
    }
    joined.push(line);
  }

  const blocks: ProductDescriptionBlock[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (const line of joined) {
    const bullet = line.match(/^[•·*-]\s+(.+)$/);
    if (!line) {
      flushParagraph();
    } else if (bullet) {
      flushParagraph();
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === "ul") previous.items.push(bullet[1]!);
      else blocks.push({ kind: "ul", items: [bullet[1]!] });
    } else if (line.length <= 40 && !/[.!?,]$/.test(line) && !/:\s*\S/.test(line) && /^[A-Z]/.test(line)) {
      flushParagraph();
      blocks.push({ kind: "h", text: line.replace(/:$/, "") });
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();

  return blocks;
}
