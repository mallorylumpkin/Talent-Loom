import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { InboxList } from "@/components/messaging/inbox-list";
import { InboxTabs } from "@/components/messaging/inbox-tabs";
import { getCreatorContext } from "@/lib/creator/context";
import type { InboxItem } from "@/lib/messaging/types";

export const metadata: Metadata = { title: "Messages" };

export default async function CreatorMessagesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const archived = view === "archived";
  const { supabase } = await getCreatorContext();
  const { data } = await supabase.rpc("my_inbox");
  const items = (data ?? []) as InboxItem[];
  return (
    <>
      <PageHeader title="Messages" description="Conversations with companies whose inquiries you accepted." />
      <div className="max-w-3xl space-y-4">
        <InboxTabs base="/creator/messages" archived={archived} archivedCount={items.filter((i) => i.archived).length} />
        <InboxList items={items} side="creator" basePath="/creator/messages" showArchived={archived} />
      </div>
    </>
  );
}

