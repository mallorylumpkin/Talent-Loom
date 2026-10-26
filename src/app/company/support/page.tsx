import type { Metadata } from "next";
import { SupportHome } from "@/components/support/support-views";
import { getCompanyContext } from "@/lib/company/context";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  await getCompanyContext();
  return <SupportHome base="/company/support" />;
}
