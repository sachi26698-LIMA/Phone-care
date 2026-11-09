"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  FileBarChart,
  LayoutDashboard,
  Menu,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { PRIMARY_NAV, SECONDARY_NAV } from "@/components/layout/nav-items";
import { RunScanButton, ScanStatusPill } from "@/components/layout/run-scan-button";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { summarizeHealth } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  scan: ScanLine,
  report: FileBarChart,
  sparkles: Sparkles,
  book: BookOpen,
  shield: ShieldCheck,
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group flex items-center gap-3 rounded-xl outline-none"
      aria-label="PhoneCare home"
    >
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-accent via-accent-deep to-violet shadow-[0_10px_30px_-10px] shadow-accent/50">
        <Smartphone className="size-5 text-canvas" strokeWidth={2.4} aria-hidden="true" />
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
        <span className="pointer-events-none absolute inset-y-0 -left-full w-1/2 animate-sheen bg-white/20 blur-md" />
      </span>
      {!compact ? (
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="font-display text-[17px] font-semibold tracking-tight text-fg">
              PhoneCare
            </span>
            <span className="rounded border border-accent/30 bg-accent/10 px-1 py-px text-[9px] font-semibold uppercase tracking-[0.12em] text-accent">
              AI
            </span>
          </span>
          <span className="block text-[9.5px] uppercase tracking-[0.2em] text-faint">
            Browser diagnostics
          </span>
        </span>
      ) : null}
    </Link>
  );
}

function NavLink({
  href,
  label,
  icon,
  onNavigate,
  compact = false,
}: {
  href: string;
  label: string;
  icon: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  const Icon = ICONS[icon] ?? LayoutDashboard;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all",
        active
          ? "bg-gradient-to-r from-accent/[0.14] to-violet/[0.06] text-fg"
          : "text-muted hover:bg-surface-2/60 hover:text-fg",
      )}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-accent to-violet" />
      ) : null}
      <Icon
        className={cn(
          "size-[18px] transition-colors",
          active ? "text-accent" : "text-faint group-hover:text-muted",
        )}
        aria-hidden="true"
      />
      <span>{label}</span>
      {compact ? null : null}
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { state } = useDiagnostics();
  const health = summarizeHealth(state);

  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <Logo />

      <nav aria-label="Primary" className="space-y-1">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="rounded-2xl border border-line-soft bg-gradient-to-br from-surface-2/70 to-canvas-deep/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
            Evidence coverage
          </p>
          <span className="font-display text-sm font-semibold text-accent">
            {health.confidence}%
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-canvas-deep">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-violet transition-[width] duration-700"
            style={{ width: `${Math.max(2, health.confidence)}%` }}
          />
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
          {health.runModules === 0
            ? "No modules scanned yet. Start a full scan to map this device."
            : `${health.runModules} of 9 modules complete. ${health.evidenceMix.unavailable} metric${health.evidenceMix.unavailable === 1 ? "" : "s"} not exposed by this browser.`}
        </p>
        <Link
          href="/methodology"
          onClick={onNavigate}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
        >
          How readings work
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="mt-auto space-y-1">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line-soft bg-surface-2/30 px-3 py-2.5">
          <ShieldCheck className="size-4 shrink-0 text-good" aria-hidden="true" />
          <p className="text-[10.5px] leading-snug text-muted">
            Runs locally.
            <br />
            <span className="text-faint">No account, no telemetry.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function pageTitle(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/diagnostics/")) {
    return "Diagnostics";
  }
  const match = [...PRIMARY_NAV, ...SECONDARY_NAV].find(
    (item) => item.href !== "/" && pathname.startsWith(item.href),
  );
  return match?.label ?? "PhoneCare";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      // Minimal focus trap: keep keyboard focus inside the drawer.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="relative min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas"
      >
        Skip to content
      </a>

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-canvas" />
        <div className="absolute -left-40 -top-40 size-[38rem] rounded-full bg-accent/[0.09] blur-[120px]" />
        <div className="absolute -right-32 top-1/4 size-[32rem] rounded-full bg-violet/[0.08] blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 size-[30rem] rounded-full bg-accent-deep/[0.06] blur-[120px]" />
        <div className="absolute inset-0 grid-backdrop opacity-60" />
      </div>

      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[268px] border-r border-line-soft bg-canvas-deep/70 backdrop-blur-xl lg:block">
        <SidebarBody />
      </aside>

      {/* Mobile drawer — only mounted while open so nothing hidden stays focusable */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-canvas-deep/80 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] animate-rise border-r border-line bg-canvas-deep"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 z-10 grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-muted hover:text-fg"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
            <div className="h-full overflow-y-auto">
              <SidebarBody onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[268px]">
        <header className="no-print sticky top-0 z-30 border-b border-line-soft bg-canvas/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-2/60 text-muted transition-colors hover:text-fg lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
            >
              <Menu className="size-[18px]" />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="lg:hidden">
                <Logo compact />
              </span>
              <div className="hidden lg:block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
                  PhoneCare
                </p>
                <p className="truncate font-display text-sm font-semibold text-fg">
                  {pageTitle(pathname)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <ScanStatusPill />
              <span className="hidden items-center gap-1.5 rounded-full border border-good/25 bg-good/[0.06] px-2.5 py-1 text-[10.5px] font-medium text-good md:inline-flex">
                <ShieldCheck className="size-3" aria-hidden="true" />
                On-device
              </span>
              <RunScanButton size="sm" />
            </div>
          </div>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16"
        >
          {children}
        </main>

        <footer className="no-print border-t border-line-soft px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-8">
          <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3 text-[11.5px] text-faint sm:flex-row sm:items-center sm:justify-between">
            <p>
              PhoneCare AI · Browser diagnostics with labelled evidence. Not a substitute for
              professional hardware service.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/methodology" className="hover:text-fg">
                Methodology
              </Link>
              <Link href="/guides" className="hover:text-fg">
                Guides
              </Link>
              <span className="text-faint/70">© {new Date().getFullYear()}</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Primary mobile"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-canvas-deep/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-1">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-accent" : "text-faint hover:text-muted",
                )}
              >
                {active ? (
                  <span className="absolute inset-x-4 top-0 h-[2px] rounded-full bg-gradient-to-r from-accent to-violet" />
                ) : null}
                <Icon className="size-[19px]" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
