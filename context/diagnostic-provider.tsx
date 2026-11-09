"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createEmptyState,
  type DiagnosticsState,
  type ModuleId,
  type ModuleResult,
  type ScreenUserCheck,
  type TouchSessionData,
  type UserProfile,
} from "@/lib/types";
import { collectDevice } from "@/lib/collect/device";
import { collectBattery } from "@/lib/collect/battery";
import { collectStorage } from "@/lib/collect/storage";
import { collectNetwork } from "@/lib/collect/network";
import { collectPerformance } from "@/lib/collect/performance";
import { collectCompatibility } from "@/lib/collect/compatibility";
import { collectTemperature, runSustainedLoad } from "@/lib/collect/temperature";
import { collectScreen, measureDisplay } from "@/lib/collect/screen";
import { collectTouch } from "@/lib/collect/touch";

const STORAGE_KEY = "phonecare.state.v1";

export interface RunProgress {
  moduleId: ModuleId;
  pct: number;
  message: string;
}

interface DiagnosticContextValue {
  state: DiagnosticsState;
  hydrated: boolean;
  running: ModuleId | null;
  batch: { active: boolean; current: number; total: number };
  progress: RunProgress | null;
  error: string | null;
  runModule: (id: ModuleId) => Promise<void>;
  runAll: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  saveScreenChecks: (checks: ScreenUserCheck[]) => Promise<void>;
  saveTouchSession: (session: TouchSessionData) => Promise<void>;
}

const DiagnosticContext = createContext<DiagnosticContextValue | null>(null);

const RUN_ORDER: ModuleId[] = [
  "device",
  "storage",
  "compatibility",
  "battery",
  "performance",
  "temperature",
  "network",
];

function loadState(): DiagnosticsState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiagnosticsState;
    if (parsed?.version !== 1) return null;
    return {
      ...createEmptyState(),
      ...parsed,
      modules: parsed.modules ?? {},
      profile: parsed.profile ?? {},
      manual: parsed.manual ?? {},
    };
  } catch {
    return null;
  }
}

export function DiagnosticProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DiagnosticsState>(() => createEmptyState());
  const [hydrated, setHydrated] = useState(false);
  const [running, setRunning] = useState<ModuleId | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState({ active: false, current: 0, total: 0 });
  const cancelled = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const loaded = loadState();
    if (loaded) setState(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage can be full or blocked; diagnostics still work in memory.
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [state, hydrated]);

  const patchModule = useCallback((id: ModuleId, patch: Partial<ModuleResult>) => {
    setState((prev) => {
      const existing = prev.modules[id];
      const base: ModuleResult =
        existing ?? {
          id,
          status: "idle",
          score: null,
          coverage: 0,
          readings: [],
          summary: "",
          notes: [],
          completedAt: null,
        };
      return {
        ...prev,
        updatedAt: Date.now(),
        modules: { ...prev.modules, [id]: { ...base, ...patch } },
      };
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    // Keep the ref authoritative: a module run triggered immediately after an
    // input change must see the new values, not the previous render's state.
    const next: DiagnosticsState = {
      ...stateRef.current,
      updatedAt: Date.now(),
      profile: { ...stateRef.current.profile, ...patch },
    };
    stateRef.current = next;
    setState(next);
  }, []);

  const execute = useCallback(
    async (id: ModuleId): Promise<void> => {
      const current = stateRef.current;
      setRunning(id);
      setError(null);
      setProgress({ moduleId: id, pct: 4, message: "Starting…" });
      patchModule(id, { status: "running" });

      try {
        let result: ModuleResult;
        switch (id) {
          case "device":
            result = await collectDevice();
            break;
          case "battery":
            result = await collectBattery(current.profile);
            break;
          case "storage":
            result = await collectStorage(current.profile);
            break;
          case "network":
            result = await collectNetwork((p) =>
              setProgress({
                moduleId: "network",
                pct: Math.round(p.progress),
                message: p.message,
              }),
            );
            break;
          case "performance":
            result = await collectPerformance();
            break;
          case "compatibility":
            result = collectCompatibility();
            break;
          case "temperature": {
            const load = await runSustainedLoad((pct, message) =>
              setProgress({ moduleId: "temperature", pct, message }),
            );
            result = collectTemperature(current.profile, load);
            break;
          }
          case "screen": {
            setProgress({ moduleId: "screen", pct: 30, message: "Sampling display timing" });
            const measurement = await measureDisplay();
            const checks = current.manual.screenChecks ?? [];
            result = collectScreen(measurement, checks);
            setState((prev) => ({
              ...prev,
              updatedAt: Date.now(),
              manual: { ...prev.manual, display: measurement },
            }));
            break;
          }
          case "touch":
            result = collectTouch(current.manual.touchSession ?? null);
            break;
          default:
            throw new Error("Unknown module");
        }

        setProgress({ moduleId: id, pct: 100, message: "Complete" });
        patchModule(id, result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        setError(`${message}. Try re-running the module.`);
        patchModule(id, {
          status: "error",
          summary: "The module failed to complete. This can happen in private browsing modes or when an API is blocked.",
          completedAt: Date.now(),
          score: null,
        });
      } finally {
        setRunning(null);
        setProgress(null);
      }
    },
    [patchModule],
  );

  const runModule = useCallback((id: ModuleId) => execute(id), [execute]);

  const runAll = useCallback(async () => {
    if (running) return;
    cancelled.current = false;
    setBatch({ active: true, current: 0, total: RUN_ORDER.length });
    for (let i = 0; i < RUN_ORDER.length; i += 1) {
      if (cancelled.current) break;
      setBatch({ active: true, current: i + 1, total: RUN_ORDER.length });
      await execute(RUN_ORDER[i]!);
    }
    setBatch({ active: false, current: 0, total: 0 });
  }, [execute, running]);

  const cancel = useCallback(() => {
    cancelled.current = true;
    setBatch({ active: false, current: 0, total: 0 });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setState(createEmptyState());
    setError(null);
  }, []);

  const saveScreenChecks = useCallback(
    async (checks: ScreenUserCheck[]) => {
      // Reuse the display measurement from the last run, or take a fresh one.
      const measurement = stateRef.current.manual.display ?? (await measureDisplay());
      const result = collectScreen(measurement, checks);
      const next: DiagnosticsState = {
        ...stateRef.current,
        updatedAt: Date.now(),
        manual: { ...stateRef.current.manual, display: measurement, screenChecks: checks },
      };
      stateRef.current = next;
      setState(next);
      patchModule("screen", result);
    },
    [patchModule],
  );

  const saveTouchSession = useCallback(
    async (session: TouchSessionData) => {
      const next: DiagnosticsState = {
        ...stateRef.current,
        updatedAt: Date.now(),
        manual: { ...stateRef.current.manual, touchSession: session },
      };
      stateRef.current = next;
      setState(next);
      patchModule("touch", collectTouch(session));
    },
    [patchModule],
  );

  const value = useMemo<DiagnosticContextValue>(
    () => ({
      state,
      hydrated,
      running,
      batch,
      progress,
      error,
      runModule,
      runAll,
      cancel,
      reset,
      updateProfile,
      saveScreenChecks,
      saveTouchSession,
    }),
    [
      state,
      hydrated,
      running,
      batch,
      progress,
      error,
      runModule,
      runAll,
      cancel,
      reset,
      updateProfile,
      saveScreenChecks,
      saveTouchSession,
    ],
  );

  return <DiagnosticContext.Provider value={value}>{children}</DiagnosticContext.Provider>;
}

export function useDiagnostics() {
  const ctx = useContext(DiagnosticContext);
  if (!ctx) throw new Error("useDiagnostics must be used inside DiagnosticProvider");
  return ctx;
}
