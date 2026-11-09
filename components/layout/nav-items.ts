export interface NavItem {
  href: string;
  label: string;
  icon: string;
  description: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", description: "Device overview and health index" },
  { href: "/diagnostics", label: "Diagnostics", icon: "scan", description: "All nine diagnostic modules" },
  { href: "/results", label: "Results", icon: "report", description: "Full report and recommendations" },
  { href: "/assistant", label: "AI Brain", icon: "sparkles", description: "Diagnostic explanations and guidance" },
  { href: "/guides", label: "Guides", icon: "book", description: "Troubleshooting playbooks" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/methodology", label: "Methodology", icon: "shield", description: "How every reading is obtained" },
];
