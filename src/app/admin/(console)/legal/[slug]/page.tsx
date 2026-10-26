import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { LegalForm } from "@/components/admin/platform-forms";
import { getAdminContext } from "@/lib/admin/context";

export const metadata: Metadata = { title: "Edit legal page" };

export default async function LegalEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase } = await getAdminContext();
  const { data: page } = await supabase.from("legal_pages").select("slug, title, body_md, version, requires_legal_review").eq("slug", slug).maybeSingle();
  if (!page) notFound();
  return (
    <>
      <PageHeader title={page.title} description={<Link href={`/legal/${slug}`} target="_blank" className="text-primary hover:underline">View live page</Link>} />
      <Card><CardBody><LegalForm page={page} /></CardBody></Card>
    </>
  );
}
