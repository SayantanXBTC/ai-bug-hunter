import type { TestCaseRow } from '../../db/repositories/testCaseRepo.js';
import type { ReliabilityRow } from '../../db/repositories/testReliabilityRepo.js';
import type { BugClusterRow } from '../../db/repositories/bugClusterRepo.js';
import type { SelectionReasonSignal } from './regressionTypes.js';

const PRIORITY_WEIGHT = {
  critical: 0.2,
  high: 0.15,
  medium: 0.1,
  low: 0.05,
} as const;

export interface RiskContext {
  reliability: ReliabilityRow | null;
  associatedBugClusters: BugClusterRow[];
  lastRunAt: Date | null;
  now: Date;
}

export interface RiskAssessment {
  score: number;
  signals: SelectionReasonSignal[];
  associatedBugClusterIds: string[];
  flakyStatus: string;
}

export function scoreTestRisk(testCase: TestCaseRow, ctx: RiskContext): RiskAssessment {
  const signals: SelectionReasonSignal[] = [];
  let score = 0;

  const failureRate = ctx.reliability ? Number(ctx.reliability.failure_count) / Math.max(1, Number(ctx.reliability.total_runs)) : 0;
  if (failureRate > 0) {
    const contribution = Math.min(0.25, failureRate * 0.25);
    signals.push({
      name: 'failure_rate',
      contribution,
      explanation: `Historical failure rate ${(failureRate * 100).toFixed(0)}%`,
    });
    score += contribution;
  }

  const regressed = ctx.associatedBugClusters.filter((c) => c.regression_status === 'regressed');
  if (regressed.length > 0) {
    signals.push({
      name: 'regression_risk',
      contribution: 0.25,
      explanation: `Associated with ${regressed.length} regressed bug cluster(s)`,
    });
    score += 0.25;
  }

  const openBugCount = ctx.associatedBugClusters.filter((c) => c.status !== 'resolved').length;
  if (openBugCount > 0) {
    const contribution = Math.min(0.2, openBugCount * 0.05);
    signals.push({
      name: 'open_bug_clusters',
      contribution,
      explanation: `${openBugCount} open/associated bug cluster(s)`,
    });
    score += contribution;
  }

  const priorityContribution = PRIORITY_WEIGHT[testCase.priority];
  signals.push({
    name: 'priority',
    contribution: priorityContribution,
    explanation: `Priority ${testCase.priority}`,
  });
  score += priorityContribution;

  if (ctx.lastRunAt) {
    const hoursSince = (ctx.now.getTime() - ctx.lastRunAt.getTime()) / 3_600_000;
    if (hoursSince > 24) {
      const contribution = 0.05;
      signals.push({
        name: 'recency_stale',
        contribution,
        explanation: `Last run ${Math.round(hoursSince)}h ago (>24h)`,
      });
      score += contribution;
    }
  } else {
    const contribution = 0.05;
    signals.push({
      name: 'never_run',
      contribution,
      explanation: 'No historical execution recorded',
    });
    score += contribution;
  }

  if (ctx.reliability && ctx.reliability.status === 'flaky') {
    // Flaky tests give unreliable signal; slightly deprioritise from regression selection.
    const contribution = -0.05;
    signals.push({
      name: 'flaky_penalty',
      contribution,
      explanation: 'Test currently classified flaky (unreliable regression signal)',
    });
    score += contribution;
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    signals,
    associatedBugClusterIds: ctx.associatedBugClusters.map((c) => c.id),
    flakyStatus: ctx.reliability?.status ?? 'insufficient_data',
  };
}
