export interface CreatorCardInfo {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_path: string | null;
}

export interface CompanyCardInfo {
  name: string;
  slug: string;
  logo_path: string | null;
}

export interface InboxItem {
  id: string;
  status: "pending" | "open" | "closed" | "blocked";
  last_message_at: string | null;
  archived: boolean;
  blocked: boolean;
  company: CompanyCardInfo;
  creator: CreatorCardInfo;
  last: { body: string; mine: boolean } | null;
  unread: number;
}

export interface ThreadMessage {
  id: string;
  body: string | null;
  created_at: string;
  mine: boolean;
  from_creator: boolean;
  sender_name: string | null;
}

export interface Conversation {
  id: string;
  status: InboxItem["status"];
  company_id: string;
  company: CompanyCardInfo;
  creator: CreatorCardInfo;
  viewer_is_creator: boolean;
  blocked: boolean;
  can_send: boolean;
  archived: boolean;
  messages: ThreadMessage[];
}

export type InquiryStatus = "sent" | "viewed" | "accepted" | "declined" | "archived" | "withdrawn";

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  sent: "New",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  archived: "Archived",
  withdrawn: "Withdrawn",
};

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam or unwanted promotion" },
  { value: "scam", label: "Scam, fraud or asking for money" },
  { value: "harassment", label: "Harassment or abusive language" },
  { value: "impersonation", label: "Pretending to be someone else" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "minor", label: "Involves someone under 18" },
  { value: "other", label: "Something else" },
];
