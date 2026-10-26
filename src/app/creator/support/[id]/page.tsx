import type { Metadata } from "next";
import { SupportThread } from "@/components/support/support-views";
import { getCreatorContext } from "@/lib/creator/context";

export const metadata: Metadata = { title: "Support request" };

export default async function SupportRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer } = await getCreatorContext();
  return <SupportThread id={id} base="/creator/support" viewerId={viewer.id} />;
}
