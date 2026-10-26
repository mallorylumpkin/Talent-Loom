/**
 * Sidebar navigation for each role. `phase` marks pages that arrive in a later
 * build phase: they render as "Soon" (not clickable) instead of 404ing.
 * When a phase ships, delete its `phase` value and the link goes live.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name, resolved in AppShell
  phase?: number;
}
export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const creatorNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/creator", icon: "LayoutDashboard" },
      { label: "Inquiries", href: "/creator/inquiries", icon: "Inbox", phase: 4 },
      { label: "Messages", href: "/creator/messages", icon: "MessageCircle", phase: 4 },
      { label: "Notifications", href: "/creator/notifications", icon: "Bell", phase: 4 },
    ],
  },
  {
    title: "Your profile",
    items: [
      { label: "Edit profile", href: "/creator/profile", icon: "UserRound" },
      { label: "Social accounts", href: "/creator/social-accounts", icon: "AtSign" },
      { label: "Analytics", href: "/creator/analytics", icon: "ChartNoAxesColumn" },
      { label: "Portfolio", href: "/creator/portfolio", icon: "Images" },
      { label: "Media kit", href: "/creator/media-kit", icon: "FileText" },
      { label: "Privacy & discoverability", href: "/creator/privacy", icon: "Eye" },
    ],
  },
  {
    title: "Pro tools",
    items: [
      { label: "Affiliate Code Vault", href: "/creator/affiliate-vault", icon: "Ticket", phase: 7 },
      { label: "Brand-Deal Tracker", href: "/creator/brand-deals", icon: "Handshake", phase: 7 },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Billing", href: "/creator/billing", icon: "CreditCard", phase: 6 },
      { label: "Settings", href: "/creator/settings", icon: "Settings" },
      { label: "Support", href: "/creator/support", icon: "LifeBuoy", phase: 5 },
    ],
  },
];

export const companyNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/company", icon: "LayoutDashboard" },
      { label: "Creator search", href: "/company/search", icon: "Search", phase: 3 },
      { label: "Saved talent", href: "/company/lists", icon: "Bookmark", phase: 3 },
      { label: "Pipeline", href: "/company/pipeline", icon: "Columns3", phase: 4 },
      { label: "Inquiries", href: "/company/inquiries", icon: "Send", phase: 4 },
      { label: "Messages", href: "/company/messages", icon: "MessageCircle", phase: 4 },
      { label: "Roster", href: "/company/roster", icon: "Users", phase: 4 },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Company profile", href: "/company/profile", icon: "Building2", phase: 3 },
      { label: "Team", href: "/company/team", icon: "UsersRound", phase: 3 },
      { label: "Reports", href: "/company/reports", icon: "ChartNoAxesColumn", phase: 7 },
      { label: "Plan & billing", href: "/company/billing", icon: "CreditCard", phase: 6 },
      { label: "Settings", href: "/company/settings", icon: "Settings", phase: 3 },
      { label: "Support", href: "/company/support", icon: "LifeBuoy", phase: 5 },
    ],
  },
];

export const adminNav: NavSection[] = [
  {
    items: [{ label: "Overview", href: "/admin", icon: "LayoutDashboard" }],
  },
  {
    title: "People",
    items: [
      { label: "Users", href: "/admin/users", icon: "Users", phase: 5 },
      { label: "Creators", href: "/admin/creators", icon: "Sparkles", phase: 5 },
      { label: "Companies", href: "/admin/companies", icon: "Building2", phase: 3 },
      { label: "Sales leads", href: "/admin/leads", icon: "Inbox", phase: 3 },
    ],
  },
  {
    title: "Trust & safety",
    items: [
      { label: "Verification queue", href: "/admin/verification", icon: "BadgeCheck", phase: 5 },
      { label: "Reports", href: "/admin/reports", icon: "Flag", phase: 5 },
      { label: "Audit log", href: "/admin/audit-logs", icon: "ScrollText", phase: 5 },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Subscriptions", href: "/admin/subscriptions", icon: "CreditCard", phase: 6 },
      { label: "Plans & pricing", href: "/admin/plans", icon: "Tags", phase: 6 },
      { label: "Promo codes", href: "/admin/promo-codes", icon: "Percent", phase: 6 },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Categories & niches", href: "/admin/taxonomy", icon: "Shapes", phase: 5 },
      { label: "Settings", href: "/admin/settings", icon: "Settings", phase: 5 },
      { label: "Legal pages", href: "/admin/legal", icon: "Scale", phase: 5 },
      { label: "Support", href: "/admin/support", icon: "LifeBuoy", phase: 5 },
      { label: "Data export", href: "/admin/exports", icon: "Download", phase: 5 },
    ],
  },
];
