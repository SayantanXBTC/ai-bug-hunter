import type {
  FailureFingerprint,
  SimilarityBand,
  SimilarityScore,
  SimilaritySignal,
} from './intelligenceTypes.js';

export const SIMILARITY_WEIGHTS = {
  sameFailedEndpoint: 0.2,
  samePage: 0.15,
  sameErrorCategory: 0.15,
  sameNormalizedError: 0.15,
  sameConsoleSignature: 0.1,
  samePageError: 0.1,
  sameSelector: 0.05,
  sameAffectedArea: 0.05,
  sameClassification: 0.05,
} as const;

// A "strong" match usually requires three or more independent signals aligning
// (e.g. same endpoint 0.20 + same page 0.15 + same normalized error 0.15 + same category 0.15).
export const STRONG_THRESHOLD = 0.6;
export const POSSIBLE_THRESHOLD = 0.35;

export function scoreSimilarity(a: FailureFingerprint, b: FailureFingerprint): SimilarityScore {
  if (a.testRunId === b.testRunId) {
    return {
      score: 1,
      band: 'strong',
      signals: [{ name: 'identical_run', contribution: 1, explanation: 'Same run id' }],
    };
  }
  const signals: SimilaritySignal[] = [];

  if (
    a.failedRequestPaths.length > 0 &&
    b.failedRequestPaths.length > 0 &&
    intersects(a.failedRequestPaths, b.failedRequestPaths)
  ) {
    signals.push({
      name: 'same_failed_endpoint',
      contribution: SIMILARITY_WEIGHTS.sameFailedEndpoint,
      explanation: `Both runs saw a failing request on ${common(a.failedRequestPaths, b.failedRequestPaths)}`,
    });
  }

  if (a.normalizedPath && a.normalizedPath === b.normalizedPath) {
    signals.push({
      name: 'same_page',
      contribution: SIMILARITY_WEIGHTS.samePage,
      explanation: `Same normalized page path ${a.normalizedPath}`,
    });
  }

  if (a.errorSignature.category === b.errorSignature.category && a.errorSignature.category !== 'unknown') {
    signals.push({
      name: 'same_error_category',
      contribution: SIMILARITY_WEIGHTS.sameErrorCategory,
      explanation: `Both classified as ${a.errorSignature.category}`,
    });
  }

  if (
    a.errorSignature.normalizedMessage &&
    a.errorSignature.normalizedMessage === b.errorSignature.normalizedMessage
  ) {
    signals.push({
      name: 'same_normalized_error',
      contribution: SIMILARITY_WEIGHTS.sameNormalizedError,
      explanation: `Same normalized error message`,
    });
  }

  if (intersects(a.consoleErrorSignatures, b.consoleErrorSignatures)) {
    signals.push({
      name: 'same_console_signature',
      contribution: SIMILARITY_WEIGHTS.sameConsoleSignature,
      explanation: `Shared normalized console.error text`,
    });
  }

  if (intersects(a.pageErrorSignatures, b.pageErrorSignatures)) {
    signals.push({
      name: 'same_page_error',
      contribution: SIMILARITY_WEIGHTS.samePageError,
      explanation: `Shared page error signature`,
    });
  }

  if (a.selectorSignature && a.selectorSignature === b.selectorSignature) {
    signals.push({
      name: 'same_selector',
      contribution: SIMILARITY_WEIGHTS.sameSelector,
      explanation: `Same failing selector signature ${a.selectorSignature}`,
    });
  }

  if (a.affectedArea && b.affectedArea && normalize(a.affectedArea) === normalize(b.affectedArea)) {
    signals.push({
      name: 'same_affected_area',
      contribution: SIMILARITY_WEIGHTS.sameAffectedArea,
      explanation: `Same investigation-derived affected area ${a.affectedArea}`,
    });
  }

  if (
    a.classification !== 'unknown' &&
    a.classification === b.classification
  ) {
    signals.push({
      name: 'same_classification',
      contribution: SIMILARITY_WEIGHTS.sameClassification,
      explanation: `Same investigation classification ${a.classification}`,
    });
  }

  const score = Math.min(1, signals.reduce((sum, s) => sum + s.contribution, 0));
  return { score, band: bandFor(score), signals };
}

export function bandFor(score: number): SimilarityBand {
  if (score >= STRONG_THRESHOLD) return 'strong';
  if (score >= POSSIBLE_THRESHOLD) return 'possible';
  return 'unlikely';
}

function intersects(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const set = new Set(a);
  for (const v of b) if (set.has(v)) return true;
  return false;
}

function common(a: string[], b: string[]): string {
  const set = new Set(a);
  for (const v of b) if (set.has(v)) return v;
  return '';
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}
