import type { InquiryStatus } from "./types";

export interface CreatorInquiry {
  id: string;
  subject: string;
  body: string;
  status: InquiryStatus;
  created_at: string;
  responded_at: string | null;
  conversation_id: string | null;
  company: {
    id: string; name: string; slug: string; logo_path: string | null; city: string | null; region: string | null;
    country: string | null; is_verified_badge: boolean; specialties: string[];
  };
}

export const INQUIRY_TONES: Record<InquiryStatus, "accent" | "neutral" | "success" | "danger" | "warning"> = {
  sent: "accent",
  viewed: "neutral",
  accepted: "success",
  declined: "danger",
  archived: "neutral",
  withdrawn: "neutral",
};
