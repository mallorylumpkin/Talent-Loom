import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/content/markdown";
import { createClient } from "@/lib/supabase/server";

async function getPage(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("legal_pages")
    .select("slug, title, body_md, version, requires_legal_review, updated_at")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await getPage((await params).slug);
  return { title: page?.title ?? "Not found" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await getPage((await params).slug);
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-sm text-muted">
        Version {page.version} · Updated{" "}
        {new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(page.updated_at))}
      </p>
      <h1 className="mt-2 text-4xl font-bold text-ink">{page.title}</h1>
      <div className="mt-8">
        <Markdown source={page.body_md} />
      </div>
    </article>
  );
}
