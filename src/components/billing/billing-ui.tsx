import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { shortDate } from "@/lib/format";

export function money(cents: number | null | undefined, currency = "USD") {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

export const SUB_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "primary" }> = {
  active: { label: "Active", tone: "success" }, trialing: { label: "Free trial", tone: "primary" },
  past_due: { label: "Payment due", tone: "warning" }, canceled: { label: "Canceled", tone: "neutral" },
  unpaid: { label: "Unpaid", tone: "danger" }, incomplete: { label: "Incomplete", tone: "warning" },
  incomplete_expired: { label: "Expired", tone: "neutral" }, paused: { label: "Paused", tone: "neutral" },
  complimentary: { label: "Complimentary", tone: "success" },
};

export interface Payment { id: string; description: string | null; amount_cents: number; currency: string; status: string;
  hosted_invoice_url: string | null; invoice_pdf_url: string | null; created_at: string; paid_at: string | null }

export function InvoiceList({ payments }: { payments: Payment[] }) {
  return (
    <Card>
      <CardHeader title="Invoices" />
      <CardBody>
        {payments.length === 0 ? <p className="text-sm text-muted">No invoices yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-ink">{p.description ?? "Subscription"}</span>
                <span className="text-muted">{shortDate(p.paid_at ?? p.created_at)}</span>
                <span className="tabular font-medium">{money(p.amount_cents, p.currency)}</span>
                <Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "neutral"}>{p.status}</Badge>
                {p.hosted_invoice_url && <a href={p.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View</a>}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export function FeatureList({ rows }: { rows: { label: string; enabled: boolean; limit: number | null; kind: string }[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2">
          {r.enabled && r.limit !== 0 ? <Check className="size-4 shrink-0 text-success" aria-hidden /> : <X className="size-4 shrink-0 text-muted" aria-hidden />}
          <span className={r.enabled && r.limit !== 0 ? "text-ink" : "text-muted"}>
            {r.label}{r.kind === "limit" && r.enabled ? `: ${r.limit === null ? "Unlimited" : r.limit}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
