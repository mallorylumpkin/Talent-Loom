/** Upload rules shared by the browser (pre-check) and server actions (re-check). Buckets enforce them too. */
export const uploadRules = {
  avatars: { maxMb: 5, types: ["image/jpeg", "image/png", "image/webp"] },
  covers: { maxMb: 8, types: ["image/jpeg", "image/png", "image/webp"] },
  "portfolio-private": { maxMb: 20, types: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
  "media-kits": { maxMb: 20, types: ["application/pdf", "image/jpeg", "image/png"] },
  "analytics-evidence": { maxMb: 10, types: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
} as const;

export type UploadBucket = keyof typeof uploadRules;

export interface UploadedFile {
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Reads the hidden fields the upload form adds, and checks they're safe for this user and bucket. */
export function readUpload(fd: FormData, bucket: UploadBucket, userId: string): UploadedFile | null {
  const storagePath = fd.get("storagePath");
  const fileName = fd.get("fileName");
  const mimeType = fd.get("mimeType");
  const sizeBytes = Number(fd.get("sizeBytes"));
  if (typeof storagePath !== "string" || typeof fileName !== "string" || typeof mimeType !== "string") return null;
  const rules = uploadRules[bucket];
  const okPath =
    storagePath.startsWith(`${userId}/`) && !storagePath.includes("..") && storagePath.length < 300;
  const okType = (rules.types as readonly string[]).includes(mimeType);
  const okSize = Number.isFinite(sizeBytes) && sizeBytes > 0 && sizeBytes <= rules.maxMb * 1024 * 1024;
  if (!okPath || !okType || !okSize) return null;
  return { storagePath, fileName: fileName.slice(0, 200), mimeType, sizeBytes };
}

export function publicStorageUrl(bucket: "avatars" | "covers" | "company-logos", path: string | null | undefined) {
  if (!path) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/(https?:\/\/[^/]+).*/, "$1");
  return `${base}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
