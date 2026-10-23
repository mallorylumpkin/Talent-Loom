import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Tiny, safe Markdown renderer for admin-editable pages (legal templates).
 * Supports: ## / ### headings, paragraphs, - and 1. lists, > quotes,
 * **bold**, *italic*, and [links](https://… or /path).
 * Produces React elements only — never raw HTML — so content can't inject scripts.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("**")) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) ?? [];
      const safe = href && (/^https:\/\//i.test(href) || (href.startsWith("/") && !href.startsWith("//")));
      out.push(
        safe ? (
          href.startsWith("/") ? (
            <Link key={key} href={href} className="font-medium text-primary underline underline-offset-2">{label}</Link>
          ) : (
            <a key={key} href={href} rel="noopener noreferrer nofollow" target="_blank" className="font-medium text-primary underline underline-offset-2">{label}</a>
          )
        ) : (
          label
        ),
      );
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return (
    <div className="space-y-4 text-[15px] leading-7 text-ink/85">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const key = `b${bi}`;
        if (block.startsWith("### ")) return <h3 key={key} className="pt-2 text-lg font-semibold text-ink">{inline(block.slice(4), key)}</h3>;
        if (block.startsWith("## ")) return <h2 key={key} className="pt-4 text-xl font-semibold text-ink">{inline(block.slice(3), key)}</h2>;
        if (lines.every((l) => l.startsWith(">"))) {
          return (
            <blockquote key={key} className="rounded-xl border-l-4 border-warning bg-warning-soft px-4 py-3 text-warning-strong">
              {inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "), key)}
            </blockquote>
          );
        }
        if (lines.every((l) => /^[-*] /.test(l))) {
          return (
            <ul key={key} className="list-disc space-y-1.5 pl-6">
              {lines.map((l, li) => <li key={li}>{inline(l.slice(2), `${key}-${li}`)}</li>)}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return (
            <ol key={key} className="list-decimal space-y-1.5 pl-6">
              {lines.map((l, li) => <li key={li}>{inline(l.replace(/^\d+\. /, ""), `${key}-${li}`)}</li>)}
            </ol>
          );
        }
        return <p key={key}>{inline(lines.join(" "), key)}</p>;
      })}
    </div>
  );
}
