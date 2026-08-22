import type { BrowserName } from '../types/execution.js';

export interface EvidenceOptions {
  screenshotOnFailure: boolean;
  screenshotOnSuccess: boolean;
  captureDomOnFailure: boolean;
  captureConsole: boolean;
  captureNetwork: boolean;
  capturePageErrors: boolean;
  includeEvidenceOnSuccess: boolean;
  maxConsoleMessages: number;
  maxNetworkEntries: number;
  maxDomBytes: number;
}

export const DEFAULT_EVIDENCE_OPTIONS: EvidenceOptions = {
  screenshotOnFailure: true,
  screenshotOnSuccess: false,
  captureDomOnFailure: true,
  captureConsole: true,
  captureNetwork: true,
  capturePageErrors: true,
  includeEvidenceOnSuccess: false,
  maxConsoleMessages: 200,
  maxNetworkEntries: 500,
  maxDomBytes: 512 * 1024,
};

export interface ScreenshotEvidence {
  mimeType: 'image/png';
  encoding: 'base64';
  data: string;
  byteLength: number;
  capturedAt: string;
}

export interface DOMEvidence {
  html: string;
  truncated: boolean;
  byteLength: number;
  capturedAt: string;
}

export type ConsoleMessageType =
  | 'log'
  | 'info'
  | 'warning'
  | 'error'
  | 'debug'
  | 'other';

export interface ConsoleEvidence {
  type: ConsoleMessageType;
  text: string;
  timestamp: string;
}

export interface PageErrorEvidence {
  message: string;
  name: string;
  timestamp: string;
}

export type NetworkFailureType = 'http' | 'network' | 'aborted';

export interface NetworkFailureEvidence {
  type: NetworkFailureType;
  status?: number;
  message?: string;
}

export interface NetworkEvidence {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  responseUrl?: string;
  timestamp: string;
  failure?: NetworkFailureEvidence;
}

export interface BrowserMetadata {
  name: BrowserName;
  version: string;
  userAgent: string;
  viewport: { width: number; height: number } | null;
  url: string;
  title: string;
}

export interface StepMetadata {
  index: number;
  action: string;
}

export interface EvidenceTruncationInfo {
  console: boolean;
  network: boolean;
  dom: boolean;
}

export interface EvidencePackage {
  id: string;
  collectedAt: string;
  testId: string;
  failingStepIndex?: number;
  browser: BrowserMetadata | null;
  screenshot?: ScreenshotEvidence;
  dom?: DOMEvidence;
  consoleLogs: ConsoleEvidence[];
  pageErrors: PageErrorEvidence[];
  networkRequests: NetworkEvidence[];
  failedRequests: NetworkEvidence[];
  metadata: {
    truncated: EvidenceTruncationInfo;
    counts: {
      consoleLogs: number;
      pageErrors: number;
      networkRequests: number;
      failedRequests: number;
    };
  };
}
