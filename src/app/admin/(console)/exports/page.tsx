import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin/context";

export const metadata: Metadata = { title: "Data export" };

const ITEMS = [
  ["users", "Users", "Every account: email, type, status, dates"],
  ["creators", "Creators", "Profile basics, discoverability, completeness"],
  ["companies", "Management companies", "Company details and review status"],
  ["inquiries", "Inquiries", "Who contacted whom and the outcome (no message text)"],
  ["leads", "Sales leads", "Contact-sales submissions"],
  ["support", "Support requests", "Subjects, topics and status"],
  ["audit_logs", "Audit log", "Every recorded admin and security action"],
];

export default async function ExportsPage() {
  await getAdminContext();
  return (
    <>
      <PageHeader title="Data export" description="CSV files open in Excel, Numbers or Google Sheets. Every download is recorded in the audit log. These files contain personal data — store them securely." />
      <div className="grid gap-4 sm:grid-cols-2">
        {ITEMS.map(([key, label, desc]) => (
          <Card key={key}>
            <CardBody className="flex items-center gap-4">
              <div className="min-w-0 flex-1"><p className="font-medium text-ink">{label}</p><p className="text-sm text-muted">{desc}</p></div>
              <a href={`/admin/exports/${key}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-sm font-medium text-white hover:bg-ink/85">
                <Download className="size-4" aria-hidden /> CSV
              </a>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
