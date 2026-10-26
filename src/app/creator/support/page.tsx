import type { Metadata } from "next";
import { SupportHome } from "@/components/support/support-views";
import { getCreatorContext } from "@/lib/creator/context";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  await getCreatorContext();
  return <SupportHome base="/creator/support" />;
}
