import { parseMarkdownLite, type Inline } from "@/features/seller-ai/copilot/markdown";

function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-semibold">
            {p.text}
          </strong>
        ) : p.code ? (
          <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em]">
            {p.text}
          </code>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Copilot answer text: paragraphs, bullets, numbered lists, bold, code. Text nodes only, never HTML. */
export function MarkdownLite({ text }: { text: string }) {
  const blocks = parseMarkdownLite(text);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.kind === "p" || b.kind === "h") {
          return (
            <p key={i} className={b.kind === "h" ? "font-semibold" : "whitespace-pre-line"}>
              <Inlines parts={b.inline} />
            </p>
          );
        }
        const List = b.kind === "ul" ? "ul" : "ol";
        return (
          <List key={i} className={`space-y-1 ps-5 ${b.kind === "ul" ? "list-disc" : "list-decimal"}`}>
            {b.items.map((item, j) => (
              <li key={j}>
                <Inlines parts={item} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
