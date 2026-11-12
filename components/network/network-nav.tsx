"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/network", label: "Overview" },
  { href: "/network/quality", label: "Quality test" },
  { href: "/network/survey", label: "Indoor survey" },
  { href: "/network/troubleshoot", label: "Troubleshoot" },
] as const;

export function NetworkNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Network lab sections" className="flex flex-wrap gap-1.5">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
              active
                ? "border-purple/30 bg-purple text-white"
                : "border-line bg-white text-muted hover:border-lavender/60 hover:text-indigo",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
