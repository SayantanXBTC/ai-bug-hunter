import type { ApplicationModel, TestDefinition } from '@ai-bug-hunter/test-engine';

export type TestGenerationGoal =
  | 'smoke'
  | 'functional'
  | 'negative'
  | 'validation'
  | 'navigation'
  | 'exploratory';

export interface TestGenerationInput {
  applicationModel: ApplicationModel;
  goal: TestGenerationGoal;
  targetPage?: string;
  categories?: string[];
  maxTests?: number;
}

export type TestValidationIssue =
  | { kind: 'unsupported_action'; message: string; action?: string }
  | { kind: 'invented_selector'; message: string; selector: string; stepIndex: number }
  | { kind: 'out_of_scope_url'; message: string; url: string; stepIndex?: number }
  | { kind: 'invalid_url'; message: string; url: string; stepIndex?: number }
  | { kind: 'malformed_step'; message: string; stepIndex: number }
  | { kind: 'duplicate_test'; message: string };

export interface ValidatedGeneratedTest {
  test: TestDefinition;
  description?: string;
  category?: string;
  validationStatus: 'valid' | 'invalid';
  issues: TestValidationIssue[];
}

export type TestGenerationStatus = 'success' | 'validation_error' | 'provider_error';

export interface TestGenerationOutput {
  status: TestGenerationStatus;
  tests: ValidatedGeneratedTest[];
  warnings: string[];
  provider: string;
  model: string;
  durationMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  message?: string;
}

export interface LLMApplicationContext {
  baseUrl: string;
  discoveredAt: string;
  pages: Array<{
    url: string;
    path: string;
    title: string;
    headings: Array<{ level: number; text: string }>;
    forms: Array<{
      method: string;
      action?: string;
      fields: Array<{
        name?: string;
        type: string;
        label?: string;
        required: boolean;
        selectors: Array<{ strategy: string; value: string; confidence: number; unique: boolean }>;
      }>;
      submitSelectors: Array<{ strategy: string; value: string; confidence: number; unique: boolean }>;
    }>;
    elements: Array<{
      category: string;
      tagName: string;
      role?: string;
      accessibleName?: string;
      text?: string;
      testId?: string;
      selectors: Array<{ strategy: string; value: string; confidence: number; unique: boolean }>;
    }>;
    links: Array<{ text: string; normalizedUrl: string; inScope: boolean }>;
  }>;
}
