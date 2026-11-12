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
  Wifi,
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
  wifi: Wifi,
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group flex min-w-0 items-center gap-2.5 rounded-xl outline-none"
      aria-label="PhoneCare home"
    >
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-gradient-to-br from-purple via-[#7a63cf] to-indigo shadow-[0_8px_18px_-8px_rgba(106,90,205,0.75)]">
        <Smartphone className="size-[18px] text-white" strokeWidth={2.3} aria-hidden="true" />
        <span className="absolute inset-0 rounded-[13px] ring-1 ring-inset ring-white/30" />
      </span>
      {!compact ? (
        <span className="min-w-0 leading-tight">
          <span className="flex items-center gap-1.5">
            <span className="font-display text-[16.5px] font-semibold tracking-tight text-fg">
              PhoneCare
            </span>
            <span className="rounded-md border border-purple/25 bg-purple/[0.08] px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em] text-purple">
              AI
            </span>
          </span>
          <span className="mt-0.5 block text-[10px] font-medium tracking-[0.02em] text-faint">
            Browser diagnostics
          </span>
        </span>
      ) : null}
    </Link>
  );
}

function NavPill({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  onNavigate?: () => void;
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
        "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all duration-200",
        active
          ? "bg-purple text-white shadow-[0_10px_20px_-12px_rgba(106,90,205,0.9)]"
          : "text-muted hover:bg-surface-2 hover:text-indigo",
      )}
    >
      <Icon className={cn("size-4", active ? "text-white" : "text-lavender")} aria-hidden="true" />
      {label}
    </Link>
  );
}

function DrawerLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  onNavigate?: () => void;
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
        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
        active ? "bg-purple/[0.09] text-indigo" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg",
          active ? "bg-purple text-white" : "bg-surface-2 text-lavender",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      {label}
    </Link>
  );
}

function DrawerBody({ onNavigate }: { onNavigate?: () => void }) {
  const { state } = useDiagnostics();
  const health = summarizeHealth(state);

  return (
    <div className="flex h-full flex-col gap-5 p-5">
      <Logo />

      <nav aria-label="Primary" className="space-y-1">
        {PRIMARY_NAV.map((item) => (
          <DrawerLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="rounded-2xl border border-line-soft bg-surface-2/70 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            Evidence coverage
          </p>
          <span className="font-display text-sm font-semibold text-purple">
            {health.confidence}%
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple to-lavender transition-[width] duration-700"
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
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-purple hover:underline"
        >
          How readings work
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="mt-auto space-y-1">
        {SECONDARY_NAV.map((item) => (
          <DrawerLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-line-soft bg-white px-3 py-2.5">
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
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-purple focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      {/* Soft ambient wash — warm light theme, no dark surfaces */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-canvas" />
        <div className="absolute -left-32 -top-40 size-[34rem] rounded-full bg-lavender/[0.13] blur-[130px]" />
        <div className="absolute -right-24 top-10 size-[26rem] rounded-full bg-champagne/40 blur-[120px]" />
        <div className="absolute inset-0 grid-backdrop" />
      </div>

      <header className="no-print sticky top-0 z-40 px-3 pt-3 sm:px-5 lg:px-8">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-2 rounded-2xl border border-line-soft bg-white/92 px-2.5 shadow-[0_10px_30px_-24px_rgba(45,43,85,0.55)] backdrop-blur-md sm:gap-4 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-line-soft bg-white text-muted transition-colors hover:border-lavender/60 hover:text-indigo lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
            >
              <Menu className="size-[18px]" />
            </button>
            <Logo />
          </div>

          <nav aria-label="Primary" className="mx-auto hidden items-center gap-1 lg:flex">
            {PRIMARY_NAV.map((item) => (
              <NavPill key={item.href} {...item} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
            <ScanStatusPill />
            <span className="hidden items-center gap-1.5 rounded-full border border-good/25 bg-good/[0.07] px-2.5 py-1 text-[10.5px] font-medium text-good xl:inline-flex">
              <ShieldCheck className="size-3" aria-hidden="true" />
              On-device
            </span>
            <RunScanButton size="sm" className="hidden sm:inline-flex" />
          </div>
        </div>
      </header>

      {/* Mobile drawer — only mounted while open so nothing hidden stays focusable */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-indigo/25 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] animate-rise border-r border-line-soft bg-canvas shadow-lift"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 z-10 grid size-9 place-items-center rounded-lg border border-line-soft bg-white text-muted hover:text-indigo"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
            <div className="h-full overflow-y-auto">
              <DrawerBody onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <main
        id="main"
        className="mx-auto w-full max-w-[1280px] px-3 pb-28 pt-5 sm:px-5 sm:pt-7 lg:px-8 lg:pb-16"
      >
        {children}
      </main>

      <footer className="no-print px-3 pb-28 pt-2 sm:px-5 lg:px-8 lg:pb-10">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 border-t border-line-soft pt-6 text-[11.5px] text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            PhoneCare AI · Browser diagnostics with labelled evidence. Not a substitute for
            professional hardware service.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/methodology" className="hover:text-indigo">
              Methodology
            </Link>
            <Link href="/guides" className="hover:text-indigo">
              Guides
            </Link>
            <span className="text-faint/80">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Primary mobile"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-24px_rgba(45,43,85,0.5)] backdrop-blur-md lg:hidden"
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
                  "relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-purple" : "text-faint hover:text-muted",
                )}
              >
                {active ? (
                  <span className="absolute inset-x-5 top-0 h-[2.5px] rounded-full bg-purple" />
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
