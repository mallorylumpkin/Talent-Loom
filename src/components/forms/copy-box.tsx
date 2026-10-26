"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Read-only text with a copy button (used for one-time setup links). */
export function CopyBox({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      {label && <p className="text-sm font-medium text-ink">{label}</p>}
      <div className="flex items-stretch gap-2">
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 font-mono text-xs text-ink" aria-label={label ?? "Link"} />
        <button type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-canvas">
          {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
