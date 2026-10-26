import type { Metadata } from "next";
import { ConversationView } from "@/components/messaging/conversation-page";
import { requireCompany } from "@/lib/company/context";

export const metadata: Metadata = { title: "Conversation" };

export default async function CompanyConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCompany();
  return <ConversationView id={id} side="company" />;
}
