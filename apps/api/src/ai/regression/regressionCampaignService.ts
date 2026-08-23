import type { Pool } from 'pg';
import { logger } from '@ai-bug-hunter/test-engine';
import type {
  ExecutionResult,
  TestDefinition,
  TestExecutor as TestExecutorType,
} from '@ai-bug-hunter/test-engine';
import { TestExecutor } from '@ai-bug-hunter/test-engine';
import type { LLMProvider } from '../providers/llmProvider.js';
import { getApplicationById } from '../../db/repositories/applicationRepo.js';
import { listTestCases, type TestCaseRow } from '../../db/repositories/testCaseRepo.js';
import { getReliabilityByExternalId } from '../../db/repositories/testReliabilityRepo.js';
import type { BugClusterRow } from '../../db/repositories/bugClusterRepo.js';
import { scoreTestRisk } from './riskScorer.js';
import { selectTests } from './testSelector.js';
import type {
  CampaignQuality,
  CampaignStatus,
  CampaignTrigger,
  SelectedTest,
  SelectionStrategy,
} from './regressionTypes.js';
import {
  getCampaignById,
  insertCampaign,
  insertCampaignTest,
  listCampaignTests,
  updateCampaign,
  updateCampaignTest,
} from '../../db/repositories/regressionCampaignRepo.js';
import type { RegressionCampaignRow } from '../../db/repositories/regressionCampaignRepo.js';
import { TestRunPersistenceService } from '../../services/testRunPersistenceService.js';

export interface RegressionCampaignServiceOptions {
  pool: Pool;
  persistence: TestRunPersistenceService;
  maxConcurrency: number;
  maxAutoInvestigations: number;
  provider?: LLMProvider | null;
  executorFactory?: () => TestExecutorType;
  investigateFailed?: (testRunId: string) => Promise<void>;
  runBugIntelligence?: (testRunIds: string[]) => Promise<void>;
}

export interface CreateCampaignInput {
  applicationId: string | null;
  name?: string;
  strategy: SelectionStrategy;
  trigger?: CampaignTrigger;
  maxTests?: number;
}

export interface CampaignPreview {
  campaign: RegressionCampaignRow;
  selected: SelectedTest[];
}

export class RegressionCampaignService {
  constructor(private readonly opts: RegressionCampaignServiceOptions) {}

  async createCampaign(input: CreateCampaignInput): Promise<CampaignPreview> {
    // Load application (optional).
    if (input.applicationId) {
      const app = await getApplicationById(this.opts.pool, input.applicationId);
      if (!app) throw new Error(`Application not found: ${input.applicationId}`);
    }
    // Load enabled test cases.
    const { items: testCases } = await listTestCases(this.opts.pool, {
      page: 1,
      limit: 1000,
      ...(input.applicationId ? { applicationId: input.applicationId } : {}),
      enabled: true,
    });
    if (testCases.length === 0) {
      throw new Error('No enabled test cases available for the requested application');
    }

    const risks = await this.buildRiskMap(testCases);
    const selected = selectTests({
      testCases,
      riskByTestCaseId: risks,
      strategy: input.strategy,
      ...(input.maxTests !== undefined ? { maxTests: input.maxTests } : {}),
    });

    const campaign = await insertCampaign(this.opts.pool, {
      applicationId: input.applicationId,
      name: input.name ?? `${input.strategy} campaign ${new Date().toISOString()}`,
      trigger: input.trigger ?? 'manual',
      strategy: input.strategy,
      requestedTestCount: input.maxTests ?? testCases.length,
      selectedTestCount: selected.length,
    });

    for (let i = 0; i < selected.length; i += 1) {
      const s = selected[i]!;
      await insertCampaignTest(this.opts.pool, {
        campaignId: campaign.id,
        testCaseId: s.testCaseId,
        selectionScore: s.selectionScore,
        selectionReason: s.selectionReason,
        ordinal: i,
      });
    }
    logger.info('campaign:created', {
      campaignId: campaign.id,
      strategy: input.strategy,
      selected: selected.length,
    });
    return { campaign, selected };
  }

  async runCampaign(campaignId: string): Promise<RegressionCampaignRow> {
    const campaign = await getCampaignById(this.opts.pool, campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status !== 'queued') {
      throw new Error(`Campaign cannot start from status ${campaign.status}`);
    }

    await updateCampaign(this.opts.pool, campaignId, {
      status: 'running',
      startedAt: new Date(),
    });
    logger.info('campaign:run-start', { campaignId, selected: campaign.selected_test_count });

    const members = await listCampaignTests(this.opts.pool, campaignId);
    const createdRunIds: string[] = [];
    let passed = 0;
    let failed = 0;
    let errors = 0;
    let investigations = 0;
    const executorFactory = this.opts.executorFactory ?? (() => new TestExecutor());

    for (const member of members) {
      const currentState = await getCampaignById(this.opts.pool, campaignId);
      if (currentState?.cancel_requested) {
        await updateCampaignTest(this.opts.pool, campaignId, member.test_case_id, { status: 'skipped' });
        logger.info('campaign:cancel-skip', { campaignId, testCaseId: member.test_case_id });
        continue;
      }

      const { rows: tcRows } = await this.opts.pool.query<TestCaseRow>(
        'SELECT * FROM test_cases WHERE id = $1',
        [member.test_case_id],
      );
      const tc = tcRows[0];
      if (!tc) {
        await updateCampaignTest(this.opts.pool, campaignId, member.test_case_id, { status: 'skipped' });
        continue;
      }

      await updateCampaignTest(this.opts.pool, campaignId, member.test_case_id, {
        status: 'running',
        startedAt: new Date(),
      });

      let execResult: ExecutionResult | null = null;
      try {
        const executor = executorFactory();
        execResult = await executor.run(tc.definition as TestDefinition);
      } catch (err) {
        errors += 1;
        await updateCampaignTest(this.opts.pool, campaignId, member.test_case_id, {
          status: 'error',
          finishedAt: new Date(),
        });
        logger.warn('campaign:exec-error', {
          campaignId,
          testCaseId: member.test_case_id,
          error: err instanceof Error ? err.message : 'unknown',
        });
        continue;
      }

      const persisted = await this.opts.persistence.persist(execResult, {
        testCaseId: tc.id,
      });
      createdRunIds.push(persisted.run.id);
      await updateCampaignTest(this.opts.pool, campaignId, member.test_case_id, {
        status: execResult.status,
        executionRunId: persisted.run.id,
        finishedAt: new Date(),
      });

      if (execResult.status === 'passed') passed += 1;
      else if (execResult.status === 'failed') failed += 1;
      else errors += 1;

      if (
        execResult.status !== 'passed' &&
        this.opts.investigateFailed &&
        investigations < this.opts.maxAutoInvestigations
      ) {
        try {
          await this.opts.investigateFailed(persisted.run.id);
          investigations += 1;
        } catch (err) {
          logger.warn('campaign:investigation-failed', {
            campaignId,
            error: err instanceof Error ? err.message : 'unknown',
          });
        }
      }
    }

    if (createdRunIds.length > 0 && this.opts.runBugIntelligence) {
      try {
        await this.opts.runBugIntelligence(createdRunIds);
      } catch (err) {
        logger.warn('campaign:bug-intelligence-failed', {
          campaignId,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    const total = passed + failed + errors;
    const finalStatus: CampaignStatus =
      (await getCampaignById(this.opts.pool, campaignId))?.cancel_requested === true
        ? 'cancelled'
        : errors === total && total > 0
          ? 'error'
          : failed + errors > 0
            ? 'failed'
            : 'passed';
    const quality = await this.computeQuality(campaignId, {
      passed,
      failed,
      errors,
      createdRunIds,
    });
    const finalRow = await updateCampaign(this.opts.pool, campaignId, {
      status: finalStatus,
      finishedAt: new Date(),
      totalRuns: total,
      passedRuns: passed,
      failedRuns: failed,
      errorRuns: errors,
      quality,
    });
    logger.info('campaign:run-complete', {
      campaignId,
      status: finalStatus,
      passed,
      failed,
      errors,
      quality,
    });
    return finalRow!;
  }

  async cancelCampaign(campaignId: string): Promise<RegressionCampaignRow | null> {
    return await updateCampaign(this.opts.pool, campaignId, { cancelRequested: true });
  }

  private async buildRiskMap(testCases: TestCaseRow[]): Promise<Map<string, ReturnType<typeof scoreTestRisk>>> {
    const map = new Map<string, ReturnType<typeof scoreTestRisk>>();
    const now = new Date();

    for (const tc of testCases) {
      const externalId = tc.external_test_id ?? tc.definition.id ?? tc.id;
      const reliability = await getReliabilityByExternalId(this.opts.pool, externalId);
      const clusters = await this.loadAssociatedClusters(externalId);
      const lastRunAt = reliability?.last_run_at ?? null;
      map.set(
        tc.id,
        scoreTestRisk(tc, {
          reliability,
          associatedBugClusters: clusters,
          lastRunAt,
          now,
        }),
      );
    }
    return map;
  }

  private async loadAssociatedClusters(externalTestId: string): Promise<BugClusterRow[]> {
    const { rows } = await this.opts.pool.query<BugClusterRow>(
      `SELECT DISTINCT c.* FROM bug_clusters c
       JOIN bug_cluster_members m ON m.cluster_id = c.id
       JOIN test_runs r ON r.id = m.test_run_id
       WHERE r.external_test_id = $1`,
      [externalTestId],
    );
    return rows;
  }

  private async computeQuality(
    campaignId: string,
    r: { passed: number; failed: number; errors: number; createdRunIds: string[] },
  ): Promise<CampaignQuality> {
    const total = r.passed + r.failed + r.errors;
    if (total === 0) return 'inconclusive';

    const members = await listCampaignTests(this.opts.pool, campaignId);
    const { rows: criticalCases } = await this.opts.pool.query<{ id: string; priority: string }>(
      `SELECT id, priority FROM test_cases WHERE id = ANY($1::uuid[])`,
      [members.map((m) => m.test_case_id)],
    );
    const criticalIds = new Set(criticalCases.filter((t) => t.priority === 'critical').map((t) => t.id));
    const criticalFailed = members.some(
      (m) => criticalIds.has(m.test_case_id) && (m.status === 'failed' || m.status === 'error'),
    );
    if (criticalFailed) return 'failed';

    // Check for any regressed cluster among created runs.
    const runIds = r.createdRunIds;
    if (runIds.length > 0) {
      const { rows: regressed } = await this.opts.pool.query<{ id: string }>(
        `SELECT DISTINCT c.id FROM bug_clusters c
         JOIN bug_cluster_members m ON m.cluster_id = c.id
         WHERE m.test_run_id = ANY($1::uuid[]) AND c.regression_status = 'regressed'`,
        [runIds],
      );
      if (regressed.length > 0) return 'failed';
    }

    if (r.failed + r.errors > 0) return 'degraded';
    return 'healthy';
  }
}

/**
 * The re-export makes it possible to mock the persistence service in tests without
 * duplicating the interface here.
 */
export type { TestRunPersistenceService };
