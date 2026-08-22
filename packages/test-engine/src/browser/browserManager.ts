import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { logger } from '../logger.js';
import { DEFAULT_EXECUTION_OPTIONS, type BrowserName } from '../types/execution.js';

export interface BrowserSession {
  readonly page: Page;
  readonly context: BrowserContext;
  close(): Promise<void>;
}

export interface BrowserManagerOptions {
  browser?: BrowserName;
  headless?: boolean;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private readonly browserName: BrowserName;
  private readonly headless: boolean;

  constructor(opts: BrowserManagerOptions = {}) {
    this.browserName = opts.browser ?? DEFAULT_EXECUTION_OPTIONS.browser;
    this.headless = opts.headless ?? DEFAULT_EXECUTION_OPTIONS.headless;
  }

  async launch(): Promise<void> {
    if (this.browser) return;
    logger.debug('browser:launch', { browser: this.browserName, headless: this.headless });
    switch (this.browserName) {
      case 'chromium':
        this.browser = await chromium.launch({ headless: this.headless });
        break;
      default:
        throw new Error(`Unsupported browser: ${String(this.browserName)}`);
    }
  }

  async createSession(): Promise<BrowserSession> {
    if (!this.browser) await this.launch();
    if (!this.browser) throw new Error('Browser failed to launch');
    const context = await this.browser.newContext();
    const page = await context.newPage();

    let closed = false;
    const close = async (): Promise<void> => {
      if (closed) return;
      closed = true;
      try {
        await page.close({ runBeforeUnload: false });
      } catch (err) {
        logger.warn('browser:page-close-failed', { error: describe(err) });
      }
      try {
        await context.close();
      } catch (err) {
        logger.warn('browser:context-close-failed', { error: describe(err) });
      }
    };

    return { page, context, close };
  }

  async close(): Promise<void> {
    if (!this.browser) return;
    logger.debug('browser:close');
    try {
      await this.browser.close();
    } finally {
      this.browser = null;
    }
  }

  isRunning(): boolean {
    return this.browser !== null;
  }

  getName(): BrowserName {
    return this.browserName;
  }

  getVersion(): string {
    return this.browser?.version() ?? 'unknown';
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
