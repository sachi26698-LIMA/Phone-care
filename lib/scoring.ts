import { MODULES, MODULE_MAP } from "@/lib/modules";
import type { DiagnosticsState, EvidenceLevel, ModuleResult } from "@/lib/types";

export interface HealthSummary {
  overall: number | null;
  /** Too little evidence for the index to be presented as a verdict. */
  provisional: boolean;
  confidence: number;
  runModules: number;
  scorableModules: number;
  weightedCoverage: number;
  /** Share of the scoring model's total weight that produced a score (0-1). */
  scoredWeightShare: number;
  counts: { good: number; warn: number; bad: number };
  evidenceMix: Record<EvidenceLevel, number>;
  weakest: ModuleResult[];
  strongest: ModuleResult[];
}

export function summarizeHealth(state: DiagnosticsState): HealthSummary {
  const modules = Object.values(state.modules).filter(
    (m): m is ModuleResult => Boolean(m) && m.completedAt !== null,
  );
  const runModules = modules.length;
  const scorable = modules.filter((m) => m.score != null);
  const scorableModules = scorable.length;

  let weightedScore = 0;
  let weightSum = 0;
  let weightedCoverage = 0;

  for (const mod of modules) {
    const weight = MODULE_MAP[mod.id]?.weight ?? 0.1;
    weightedCoverage += weight * mod.coverage;
    if (mod.score != null) {
      weightedScore += mod.score * weight;
      weightSum += weight;
    }
  }

  const counts = { good: 0, warn: 0, bad: 0 };
  const evidenceMix: Record<EvidenceLevel, number> = {
    measured: 0,
    estimated: 0,
    user: 0,
    unavailable: 0,
  };

  for (const mod of modules) {
    for (const reading of mod.readings) {
      evidenceMix[reading.evidence] += 1;
      if (reading.status === "good") counts.good += 1;
      else if (reading.status === "warn") counts.warn += 1;
      else if (reading.status === "bad") counts.bad += 1;
    }
  }

  const sorted = [...scorable].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const totalWeight = MODULES.reduce((sum, m) => sum + m.weight, 0);

  const confidence = Math.round((weightedCoverage / totalWeight) * 100);
  const scoredWeightShare = totalWeight > 0 ? weightSum / totalWeight : 0;

  return {
    overall: weightSum > 0 ? Math.round(weightedScore / weightSum) : null,
    // A verdict needs enough of the weighted model to be scored. Without battery
    // health (20%) and disk data (14%) the index covers under half the weights,
    // and calling that "excellent" would be an overclaim.
    provisional: confidence < 40 || scorableModules < 4 || scoredWeightShare < 0.5,
    scoredWeightShare,
    confidence,
    runModules,
    scorableModules,
    weightedCoverage,
    counts,
    evidenceMix,
    weakest: sorted.slice(0, 3),
    strongest: sorted.slice(-3).reverse(),
  };
}
