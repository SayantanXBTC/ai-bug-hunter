import { z } from 'zod';
import {
  BUG_SEVERITIES,
  FAILURE_CLASSIFICATIONS,
} from './investigationTypes.js';

export const LLMHypothesisSchema = z.object({
  id: z.string().min(1).max(200),
  statement: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  reasoningSummary: z.string().min(1).max(2000),
  observedFactIds: z.array(z.string().max(200)).max(20).default([]),
  evidenceIds: z.array(z.string().max(200)).max(20).default([]),
});

export const LLMEvidenceRefSchema = z.object({
  evidenceId: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
});

export const LLMReproductionStepSchema = z.object({
  order: z.number().int().nonnegative(),
  stepIndex: z.number().int().nonnegative(),
  description: z.string().max(500).optional(),
});

export const LLMInvestigationSchema = z.object({
  classification: z.enum(FAILURE_CLASSIFICATIONS),
  severity: z.enum(BUG_SEVERITIES),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(2000),
  likelyRootCause: z.string().max(2000).nullable().optional(),
  affectedArea: z.string().max(500).nullable().optional(),
  observedFactIds: z.array(z.string().max(200)).max(50).default([]),
  hypotheses: z.array(LLMHypothesisSchema).max(10).default([]),
  supportingEvidence: z.array(LLMEvidenceRefSchema).max(30).default([]),
  reproductionStepIndices: z.array(z.number().int().nonnegative()).max(50).default([]),
  recommendedNextSteps: z.array(z.string().max(500)).max(20).default([]),
});

export type LLMInvestigation = z.infer<typeof LLMInvestigationSchema>;
