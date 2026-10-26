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
      { label: "Inquiries", href: "/creator/inquiries", icon: "Inbox" },
      { label: "Messages", href: "/creator/messages", icon: "MessageCircle" },
      { label: "Notifications", href: "/creator/notifications", icon: "Bell" },
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
      { label: "Profile insights", href: "/creator/insights", icon: "ChartNoAxesColumn" },
      { label: "Affiliate Code Vault", href: "/creator/affiliate-vault", icon: "Ticket" },
      { label: "Brand-Deal Tracker", href: "/creator/brand-deals", icon: "Handshake" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Billing", href: "/creator/billing", icon: "CreditCard" },
      { label: "Settings", href: "/creator/settings", icon: "Settings" },
      { label: "Support", href: "/creator/support", icon: "LifeBuoy" },
    ],
  },
];

export const companyNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/company", icon: "LayoutDashboard" },
      { label: "Creator search", href: "/company/search", icon: "Search" },
      { label: "Saved talent", href: "/company/lists", icon: "Bookmark" },
      { label: "Pipeline", href: "/company/pipeline", icon: "Columns3" },
      { label: "Inquiries", href: "/company/inquiries", icon: "Send" },
      { label: "Messages", href: "/company/messages", icon: "MessageCircle" },
      { label: "Notifications", href: "/company/notifications", icon: "Bell" },
      { label: "Roster", href: "/company/roster", icon: "Users" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Company profile", href: "/company/profile", icon: "Building2" },
      { label: "Team", href: "/company/team", icon: "UsersRound" },
      { label: "Reports", href: "/company/reports", icon: "ChartNoAxesColumn" },
      { label: "Plan & billing", href: "/company/billing", icon: "CreditCard" },
      { label: "Settings", href: "/company/settings", icon: "Settings" },
      { label: "Support", href: "/company/support", icon: "LifeBuoy" },
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
      { label: "Users", href: "/admin/users", icon: "Users" },
      { label: "Creators", href: "/admin/creators", icon: "Sparkles" },
      { label: "Companies", href: "/admin/companies", icon: "Building2" },
      { label: "Sales leads", href: "/admin/leads", icon: "Inbox" },
    ],
  },
  {
    title: "Trust & safety",
    items: [
      { label: "Verification queue", href: "/admin/verification", icon: "BadgeCheck" },
      { label: "Reports", href: "/admin/reports", icon: "Flag" },
      { label: "Inquiries & blocks", href: "/admin/activity", icon: "Send" },
      { label: "Audit log", href: "/admin/audit-logs", icon: "ScrollText" },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Subscriptions", href: "/admin/subscriptions", icon: "CreditCard" },
      { label: "Plans & pricing", href: "/admin/plans", icon: "Tags" },
      { label: "Promo codes", href: "/admin/promo-codes", icon: "Percent" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Categories & niches", href: "/admin/taxonomy", icon: "Shapes" },
      { label: "Settings", href: "/admin/settings", icon: "Settings" },
      { label: "Legal pages", href: "/admin/legal", icon: "Scale" },
      { label: "Support", href: "/admin/support", icon: "LifeBuoy" },
      { label: "Data export", href: "/admin/exports", icon: "Download" },
    ],
  },
];
