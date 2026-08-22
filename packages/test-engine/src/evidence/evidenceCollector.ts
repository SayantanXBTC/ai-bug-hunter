import { randomUUID } from 'node:crypto';
import type { Page, Request as PWRequest, Response as PWResponse, ConsoleMessage } from 'playwright';
import { logger } from '../logger.js';
import type { BrowserName } from '../types/execution.js';
import {
  DEFAULT_EVIDENCE_OPTIONS,
  type BrowserMetadata,
  type ConsoleEvidence,
  type ConsoleMessageType,
  type DOMEvidence,
  type EvidenceOptions,
  type EvidencePackage,
  type NetworkEvidence,
  type NetworkFailureType,
  type PageErrorEvidence,
  type ScreenshotEvidence,
} from './evidenceTypes.js';

export interface EvidenceCollectorContext {
  testId: string;
  browserName: BrowserName;
  browserVersion: string;
}

export class EvidenceCollector {
  private readonly opts: EvidenceOptions;
  private readonly ctx: EvidenceCollectorContext;
  private page: Page | null = null;

  private readonly consoleLogs: ConsoleEvidence[] = [];
  private readonly pageErrors: PageErrorEvidence[] = [];
  private readonly networkByRequest = new Map<PWRequest, NetworkEvidence>();
  private readonly networkList: NetworkEvidence[] = [];

  private consoleTruncated = false;
  private networkTruncated = false;
  private domTruncated = false;

  private screenshot: ScreenshotEvidence | undefined;
  private dom: DOMEvidence | undefined;
  private failingStepIndex: number | undefined;
  private browserMetadata: BrowserMetadata | null = null;

  private readonly listeners: Array<{ event: string; fn: (...args: unknown[]) => void }> = [];

  constructor(ctx: EvidenceCollectorContext, opts: Partial<EvidenceOptions> = {}) {
    this.ctx = ctx;
    this.opts = { ...DEFAULT_EVIDENCE_OPTIONS, ...opts };
  }

  async start(page: Page): Promise<void> {
    this.page = page;
    logger.debug('evidence:start', { testId: this.ctx.testId });

    if (this.opts.captureConsole) this.attachConsole(page);
    if (this.opts.capturePageErrors) this.attachPageErrors(page);
    if (this.opts.captureNetwork) this.attachNetwork(page);
  }

  async collectFailureEvidence(stepIndex: number): Promise<void> {
    if (!this.page || this.page.isClosed()) {
      logger.warn('evidence:page-closed-on-failure', { testId: this.ctx.testId, stepIndex });
      this.failingStepIndex = stepIndex;
      return;
    }
    this.failingStepIndex = stepIndex;

    if (this.opts.screenshotOnFailure) {
      this.screenshot = await this.captureScreenshot();
    }
    if (this.opts.captureDomOnFailure) {
      this.dom = await this.captureDom();
    }
  }

  async collectSuccessEvidence(): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    if (this.opts.screenshotOnSuccess) {
      this.screenshot = await this.captureScreenshot();
    }
  }

  async finalize(): Promise<EvidencePackage> {
    if (this.page && !this.page.isClosed()) {
      this.browserMetadata = await this.captureBrowserMetadata(this.page);
    }
    this.detachAll();

    const failed = this.networkList.filter((n) => n.failure !== undefined);
    const pkg: EvidencePackage = {
      id: randomUUID(),
      collectedAt: new Date().toISOString(),
      testId: this.ctx.testId,
      ...(this.failingStepIndex !== undefined ? { failingStepIndex: this.failingStepIndex } : {}),
      browser: this.browserMetadata,
      ...(this.screenshot ? { screenshot: this.screenshot } : {}),
      ...(this.dom ? { dom: this.dom } : {}),
      consoleLogs: this.consoleLogs,
      pageErrors: this.pageErrors,
      networkRequests: this.networkList,
      failedRequests: failed,
      metadata: {
        truncated: {
          console: this.consoleTruncated,
          network: this.networkTruncated,
          dom: this.domTruncated,
        },
        counts: {
          consoleLogs: this.consoleLogs.length,
          pageErrors: this.pageErrors.length,
          networkRequests: this.networkList.length,
          failedRequests: failed.length,
        },
      },
    };

    logger.debug('evidence:finalize', {
      testId: this.ctx.testId,
      failingStepIndex: this.failingStepIndex,
      counts: pkg.metadata.counts,
    });

    this.page = null;
    return pkg;
  }

  private attachConsole(page: Page): void {
    const handler = (msg: ConsoleMessage): void => {
      if (this.consoleLogs.length >= this.opts.maxConsoleMessages) {
        this.consoleTruncated = true;
        return;
      }
      this.consoleLogs.push({
        type: mapConsoleType(msg.type()),
        text: safeText(msg.text()),
        timestamp: new Date().toISOString(),
      });
    };
    page.on('console', handler);
    this.listeners.push({ event: 'console', fn: handler as (...args: unknown[]) => void });
  }

  private attachPageErrors(page: Page): void {
    const handler = (err: Error): void => {
      this.pageErrors.push({
        name: err.name || 'Error',
        message: safeText(err.message),
        timestamp: new Date().toISOString(),
      });
    };
    page.on('pageerror', handler);
    this.listeners.push({ event: 'pageerror', fn: handler as (...args: unknown[]) => void });
  }

  private attachNetwork(page: Page): void {
    const onRequest = (req: PWRequest): void => {
      if (this.networkList.length >= this.opts.maxNetworkEntries) {
        this.networkTruncated = true;
        return;
      }
      const entry: NetworkEvidence = {
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        timestamp: new Date().toISOString(),
      };
      this.networkByRequest.set(req, entry);
      this.networkList.push(entry);
    };

    const onResponse = (res: PWResponse): void => {
      const entry = this.networkByRequest.get(res.request());
      if (!entry) return;
      entry.status = res.status();
      entry.responseUrl = res.url();
      if (res.status() >= 400) {
        entry.failure = { type: 'http', status: res.status() };
      }
    };

    const onFailed = (req: PWRequest): void => {
      const entry = this.networkByRequest.get(req);
      if (!entry) return;
      const failure = req.failure();
      const message = failure?.errorText ?? 'request failed';
      const type: NetworkFailureType = /abort/i.test(message) ? 'aborted' : 'network';
      entry.failure = { type, message };
    };

    page.on('request', onRequest);
    page.on('response', onResponse);
    page.on('requestfailed', onFailed);
    this.listeners.push(
      { event: 'request', fn: onRequest as (...args: unknown[]) => void },
      { event: 'response', fn: onResponse as (...args: unknown[]) => void },
      { event: 'requestfailed', fn: onFailed as (...args: unknown[]) => void },
    );
  }

  private detachAll(): void {
    if (!this.page) return;
    for (const l of this.listeners) {
      try {
        // Playwright Page.off signature accepts (event, listener) at runtime.
        (this.page as unknown as { off: (e: string, f: (...args: unknown[]) => void) => void }).off(
          l.event,
          l.fn,
        );
      } catch {
        // ignore
      }
    }
    this.listeners.length = 0;
  }

  private async captureScreenshot(): Promise<ScreenshotEvidence | undefined> {
    if (!this.page || this.page.isClosed()) return undefined;
    try {
      const buf = await this.page.screenshot({ type: 'png', fullPage: false });
      return {
        mimeType: 'image/png',
        encoding: 'base64',
        data: buf.toString('base64'),
        byteLength: buf.byteLength,
        capturedAt: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn('evidence:screenshot-failed', {
        testId: this.ctx.testId,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }

  private async captureDom(): Promise<DOMEvidence | undefined> {
    if (!this.page || this.page.isClosed()) return undefined;
    try {
      const html = await this.page.evaluate(() => document.documentElement.outerHTML);
      const byteLength = Buffer.byteLength(html, 'utf8');
      let truncated = false;
      let out = html;
      if (byteLength > this.opts.maxDomBytes) {
        out = html.slice(0, this.opts.maxDomBytes);
        truncated = true;
        this.domTruncated = true;
      }
      return {
        html: out,
        truncated,
        byteLength: Buffer.byteLength(out, 'utf8'),
        capturedAt: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn('evidence:dom-failed', {
        testId: this.ctx.testId,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }

  private async captureBrowserMetadata(page: Page): Promise<BrowserMetadata | null> {
    try {
      const userAgent = await page.evaluate(() => navigator.userAgent);
      const title = await page.title().catch(() => '');
      return {
        name: this.ctx.browserName,
        version: this.ctx.browserVersion,
        userAgent,
        viewport: page.viewportSize(),
        url: page.url(),
        title,
      };
    } catch (err) {
      logger.warn('evidence:metadata-failed', {
        testId: this.ctx.testId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}

function mapConsoleType(t: string): ConsoleMessageType {
  switch (t) {
    case 'log':
    case 'info':
    case 'warning':
    case 'error':
    case 'debug':
      return t;
    default:
      return 'other';
  }
}

function safeText(s: string): string {
  const max = 4000;
  return s.length > max ? s.slice(0, max) + '…' : s;
}
