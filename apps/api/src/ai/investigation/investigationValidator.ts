import { randomUUID } from 'node:crypto';
import type { InvestigationContextBundle } from './investigationContext.js';
import type { LLMInvestigation } from './investigationSchemas.js';
import type {
  EvidenceReference,
  Hypothesis,
  InvestigationReport,
  ObservedFact,
  ReproductionStep,
} from './investigationTypes.js';

export interface BuildReportInput {
  raw: LLMInvestigation;
  bundle: InvestigationContextBundle;
  testRunId: string;
  provider: string;
  model: string;
  durationMs: number;
  testSteps: Array<{ index: number; action: string }>;
}

export function buildValidatedReport(input: BuildReportInput): InvestigationReport {
  const warnings: string[] = [];
  const { bundle, raw } = input;

  const observedFactIds = filterKnown(
    raw.observedFactIds,
    bundle.observedFactIndex,
    'observedFactIds',
    warnings,
  );

  const hypotheses: Hypothesis[] = raw.hypotheses.map((h) => {
    const fIds = filterKnown(h.observedFactIds, bundle.observedFactIndex, `hypotheses[${h.id}].observedFactIds`, warnings);
    const eIds = filterKnown(
      h.evidenceIds,
      new Set(bundle.evidenceById.keys()),
      `hypotheses[${h.id}].evidenceIds`,
      warnings,
    );
    return {
      id: h.id,
      statement: h.statement,
      confidence: clampConfidence(h.confidence),
      reasoningSummary: h.reasoningSummary,
      observedFactIds: fIds,
      evidenceIds: eIds,
    };
  });

  const supportingEvidence: EvidenceReference[] = [];
  for (const ref of raw.supportingEvidence) {
    const record = bundle.evidenceById.get(ref.evidenceId);
    if (!record) {
      warnings.push(`Rejected fabricated evidence reference: ${ref.evidenceId}`);
      continue;
    }
    supportingEvidence.push({
      evidenceId: record.id,
      evidenceType: record.evidence_type,
      description: ref.description ?? '',
    });
  }

  const stepByIndex = new Map(input.testSteps.map((s) => [s.index, s]));
  const reproductionSteps: ReproductionStep[] = [];
  raw.reproductionStepIndices.forEach((stepIndex, order) => {
    const step = stepByIndex.get(stepIndex);
    if (!step) {
      warnings.push(`Rejected fabricated reproduction step index: ${stepIndex}`);
      return;
    }
    reproductionSteps.push({
      order,
      stepIndex: step.index,
      action: step.action,
      description: `${step.action} (from test definition step ${step.index})`,
    });
  });

  const observedFacts: ObservedFact[] = observedFactIds
    .map((id) => bundle.view.observedFacts.find((f) => f.id === id))
    .filter((f): f is ObservedFact => f !== undefined);

  return {
    id: randomUUID(),
    testRunId: input.testRunId,
    classification: raw.classification,
    severity: raw.severity,
    confidence: clampConfidence(raw.confidence),
    summary: raw.summary,
    likelyRootCause: raw.likelyRootCause ?? null,
    affectedArea: raw.affectedArea ?? null,
    observedFacts,
    hypotheses,
    supportingEvidence,
    reproductionSteps,
    recommendedNextSteps: raw.recommendedNextSteps,
    validationWarnings: warnings,
    generatedAt: new Date().toISOString(),
    provider: input.provider,
    model: input.model,
    durationMs: input.durationMs,
  };
}

function filterKnown(
  ids: string[],
  known: Set<string>,
  label: string,
  warnings: string[],
): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (known.has(id)) out.push(id);
    else warnings.push(`Rejected unknown ${label}: ${id}`);
  }
  return out;
}

function clampConfidence(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
