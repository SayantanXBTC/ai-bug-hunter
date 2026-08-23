import { describe, it, expect } from 'vitest';
import {
  computeQualityScoreFromInputs,
  PASS_RATE_WEIGHT,
  CAMPAIGN_HEALTH_WEIGHT,
  MIN_RUNS_FOR_CONFIDENCE,
  type QualityScoreInputs,
  type QualityScoreRun,
} from './qualityScoreService.js';

function passedRun(): QualityScoreRun {
  return { status: 'passed', errorName: null, errorMessage: null };
}
function failedRun(): QualityScoreRun {
  return { status: 'failed', errorName: 'AssertError', errorMessage: 'no match' };
}
function criticalRun(): QualityScoreRun {
  return { status: 'error', errorName: 'FatalError', errorMessage: 'critical crash' };
}

function baseInputs(): QualityScoreInputs {
  return { runs: [], clusters: [], reliability: [], recentCampaign: null };
}

describe('computeQualityScoreFromInputs', () => {
  it('gives high score for all-passing runs', () => {
    const inputs = baseInputs();
    inputs.runs = Array.from({ length: 20 }, passedRun);
    const r = computeQualityScoreFromInputs(inputs);
    expect(r.score).toBe(100);
    expect(r.warning).toBeUndefined();
    expect(r.breakdown.passRate.raw).toBe(1);
  });

  it('gives low score for all-failing runs', () => {
    const inputs = baseInputs();
    inputs.runs = Array.from({ length: 20 }, failedRun);
    const r = computeQualityScoreFromInputs(inputs);
    expect(r.score).toBe(0);
  });

  it('adds warning flag when insufficient runs', () => {
    const inputs = baseInputs();
    inputs.runs = Array.from({ length: 2 }, passedRun);
    const r = computeQualityScoreFromInputs(inputs);
    expect(r.warning).toContain(`${MIN_RUNS_FOR_CONFIDENCE}`);
    expect(r.sampleSize).toBe(2);
  });

  it('reduces score when regressed clusters are open', () => {
    const inputs = baseInputs();
    inputs.runs = Array.from({ length: 20 }, passedRun);
    const clean = computeQualityScoreFromInputs(inputs);
    inputs.clusters = [
      { status: 'open', regressionStatus: 'regressed', severity: 'high' },
      { status: 'open', regressionStatus: 'regressed', severity: 'critical' },
    ];
    const withReg = computeQualityScoreFromInputs(inputs);
    expect(withReg.score).toBeLessThan(clean.score);
    expect(withReg.breakdown.regressions.raw).toBe(2);
  });

  it('reduces score when flaky tests present', () => {
    const inputs = baseInputs();
    inputs.runs = Array.from({ length: 20 }, passedRun);
    inputs.reliability = [
      { status: 'flaky' },
      { status: 'flaky' },
      { status: 'stable' },
      { status: 'stable' },
    ];
    const r = computeQualityScoreFromInputs(inputs);
    expect(r.score).toBeLessThan(100);
    expect(r.breakdown.flaky.raw).toBeCloseTo(0.5, 5);
  });

  it('boosts score with healthy campaign but stays clamped to 100', () => {
    const inputs = baseInputs();
    inputs.runs = Array.from({ length: 20 }, passedRun);
    inputs.recentCampaign = { quality: 'healthy' };
    const r = computeQualityScoreFromInputs(inputs);
    expect(r.score).toBe(100);
    expect(r.breakdown.campaignHealth.weightedContribution).toBe(CAMPAIGN_HEALTH_WEIGHT);
  });

  it('critical failures penalize more than regular failures', () => {
    const halfPass = Array.from({ length: 10 }, passedRun);
    const inputsRegular: QualityScoreInputs = {
      ...baseInputs(),
      runs: [...halfPass, ...Array.from({ length: 10 }, failedRun)],
    };
    const inputsCritical: QualityScoreInputs = {
      ...baseInputs(),
      runs: [...halfPass, ...Array.from({ length: 10 }, criticalRun)],
    };
    const regular = computeQualityScoreFromInputs(inputsRegular);
    const critical = computeQualityScoreFromInputs(inputsCritical);
    expect(critical.score).toBeLessThan(regular.score);
  });

  it('weights sum matches expected total (sanity)', () => {
    // Ensures constants haven't drifted from documented 100-point scale.
    const sum =
      PASS_RATE_WEIGHT + 20 /* critical */ + 15 /* regression */ + 10 /* flaky */ + 10 /* bug sev */ + CAMPAIGN_HEALTH_WEIGHT;
    expect(sum).toBe(100);
  });
});
