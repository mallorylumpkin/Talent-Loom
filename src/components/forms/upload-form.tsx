"use client";

import { useId, useState, type ReactNode } from "react";
import { FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { fileSize } from "@/lib/format";
import { uploadRules, type UploadBucket } from "@/lib/uploads";
import { ActionForm, type FormAction } from "./action-form";

const extFor: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
};

/**
 * A form with a file picker. On submit the file is uploaded straight to Supabase
 * Storage (into the user's own folder — storage rules block anything else), then
 * the Server Action receives storagePath / fileName / mimeType / sizeBytes.
 */
export function UploadForm({
  action, bucket, userId, fileLabel, fileRequired = true, children, hidden, className,
}: {
  action: FormAction; bucket: UploadBucket; userId: string; fileLabel: ReactNode; fileRequired?: boolean;
  children?: ReactNode; hidden?: Record<string, string | undefined>; className?: string;
}) {
  const id = useId();
  const rules = uploadRules[bucket];
  const [picked, setPicked] = useState<File | null>(null);
  const accept = rules.types.join(",");
  const typesLabel = rules.types.map((t) => extFor[t]?.toUpperCase()).join(", ");

  async function prepare(fd: FormData): Promise<string | null> {
    const file = fd.get("file");
    fd.delete("file");
    if (!(file instanceof File) || file.size === 0) {
      return fileRequired ? "Choose a file to upload." : null;
    }
    if (!(rules.types as readonly string[]).includes(file.type)) return `That file type isn't supported. Use ${typesLabel}.`;
    if (file.size > rules.maxMb * 1024 * 1024) return `That file is too large. The limit is ${rules.maxMb} MB.`;

    const path = `${userId}/${crypto.randomUUID()}.${extFor[file.type] ?? "bin"}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) return "The upload didn't go through. Check your connection and try again.";

    fd.set("storagePath", path);
    fd.set("fileName", file.name);
    fd.set("mimeType", file.type);
    fd.set("sizeBytes", String(file.size));
    return null;
  }

  return (
    <ActionForm action={action} prepare={prepare} hidden={hidden} className={className} resetOnSuccess>
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-ink">{fileLabel}</span>
        <label htmlFor={id}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong bg-canvas px-4 py-4 hover:border-primary">
          <FileUp className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 text-sm">
            <span className="block truncate font-medium text-ink">{picked ? picked.name : "Choose a file"}</span>
            <span className="block text-muted">
              {picked ? fileSize(picked.size) : `${typesLabel} · up to ${rules.maxMb} MB`}
            </span>
          </span>
        </label>
        <input id={id} name="file" type="file" accept={accept} className="sr-only"
          onChange={(e) => setPicked(e.currentTarget.files?.[0] ?? null)} />
      </div>
      {children}
    </ActionForm>
  );
}
