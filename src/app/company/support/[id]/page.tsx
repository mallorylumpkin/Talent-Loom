import type { Metadata } from "next";
import { SupportThread } from "@/components/support/support-views";
import { getCompanyContext } from "@/lib/company/context";

export const metadata: Metadata = { title: "Support request" };

export default async function SupportRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer } = await getCompanyContext();
  return <SupportThread id={id} base="/company/support" viewerId={viewer.id} />;
}
