import type { Metadata } from "next";
import { ConversationView } from "@/components/messaging/conversation-page";
import { getCreatorContext } from "@/lib/creator/context";

export const metadata: Metadata = { title: "Conversation" };

export default async function CreatorConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getCreatorContext();
  return <ConversationView id={id} side="creator" />;
}
