import type { TestCaseRow } from '../../db/repositories/testCaseRepo.js';
import type { RiskAssessment } from './riskScorer.js';
import type { SelectedTest, SelectionStrategy } from './regressionTypes.js';

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export interface SelectorInput {
  testCases: TestCaseRow[];
  riskByTestCaseId: Map<string, RiskAssessment>;
  strategy: SelectionStrategy;
  maxTests?: number;
}

export function selectTests(input: SelectorInput): SelectedTest[] {
  const enabled = input.testCases.filter((t) => t.enabled);
  const withAssessment = enabled.map((t) => ({ test: t, risk: input.riskByTestCaseId.get(t.id) }));

  let ordered: typeof withAssessment;
  switch (input.strategy) {
    case 'all_enabled':
      ordered = withAssessment.sort((a, b) => PRIORITY_RANK[a.test.priority] - PRIORITY_RANK[b.test.priority]);
      break;
    case 'smoke':
      ordered = withAssessment
        .filter((t) => t.test.priority === 'critical' || t.test.tags.includes('smoke') || t.test.tags.includes('authentication'))
        .sort((a, b) => PRIORITY_RANK[a.test.priority] - PRIORITY_RANK[b.test.priority]);
      break;
    case 'risk_based':
      ordered = withAssessment
        .sort((a, b) => (b.risk?.score ?? 0) - (a.risk?.score ?? 0));
      break;
    case 'changed_area':
    case 'bug_targeted':
      // Not implemented in Phase 9 — return risk_based as sane default so campaigns still work.
      ordered = withAssessment.sort((a, b) => (b.risk?.score ?? 0) - (a.risk?.score ?? 0));
      break;
  }

  const cap = input.maxTests ?? ordered.length;
  return ordered.slice(0, cap).map((t) => ({
    testCaseId: t.test.id,
    name: t.test.name,
    priority: t.test.priority,
    selectionScore: t.risk?.score ?? 0,
    selectionReason: t.risk?.signals ?? [
      { name: 'default_selection', contribution: 0, explanation: `Selected by ${input.strategy}` },
    ],
    associatedBugClusterIds: t.risk?.associatedBugClusterIds ?? [],
    flakyStatus: t.risk?.flakyStatus ?? 'insufficient_data',
  }));
}
