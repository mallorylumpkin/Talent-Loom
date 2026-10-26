import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { InboxList } from "@/components/messaging/inbox-list";
import { InboxTabs } from "@/components/messaging/inbox-tabs";
import { requireCompany } from "@/lib/company/context";
import type { InboxItem } from "@/lib/messaging/types";

export const metadata: Metadata = { title: "Messages" };

export default async function CompanyMessagesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const archived = view === "archived";
  const { supabase, company, permissions } = await requireCompany();
  if (!permissions.has("messages.view")) {
    return <Alert tone="warning">Your role doesn&apos;t include reading conversations. Ask your company owner for access.</Alert>;
  }
  const { data } = await supabase.rpc("my_inbox", { p_company_id: company.id });
  const items = (data ?? []) as InboxItem[];
  return (
    <>
      <PageHeader title="Messages" description="Conversations with creators who accepted your inquiries. Everyone on your team with access sees the same threads." />
      <div className="max-w-3xl space-y-4">
        <InboxTabs base="/company/messages" archived={archived} archivedCount={items.filter((i) => i.archived).length} />
        <InboxList items={items} side="company" basePath="/company/messages" showArchived={archived} />
      </div>
    </>
  );
}
