import type { Page } from 'playwright';
import { assertSafeUrl } from './actionTypes.js';
import type { TestAction } from '../types/execution.js';

export interface ActionExecutorOptions {
  actionTimeoutMs: number;
  navigationTimeoutMs: number;
}

export async function executeAction(
  page: Page,
  action: TestAction,
  opts: ActionExecutorOptions,
): Promise<void> {
  switch (action.action) {
    case 'navigate': {
      assertSafeUrl(action.url);
      await page.goto(action.url, {
        timeout: opts.navigationTimeoutMs,
        waitUntil: 'domcontentloaded',
      });
      return;
    }
    case 'click': {
      await page.locator(action.selector).click({ timeout: opts.actionTimeoutMs });
      return;
    }
    case 'fill': {
      await page.locator(action.selector).fill(action.value, { timeout: opts.actionTimeoutMs });
      return;
    }
    case 'selectOption': {
      await page
        .locator(action.selector)
        .selectOption(action.value, { timeout: opts.actionTimeoutMs });
      return;
    }
    case 'press': {
      await page.locator(action.selector).press(action.key, { timeout: opts.actionTimeoutMs });
      return;
    }
    case 'waitForSelector': {
      await page.locator(action.selector).waitFor({
        state: 'visible',
        timeout: action.timeoutMs ?? opts.actionTimeoutMs,
      });
      return;
    }
    case 'wait': {
      await page.waitForTimeout(action.durationMs);
      return;
    }
    default: {
      const exhaustive: never = action;
      throw new Error(`Unsupported action: ${JSON.stringify(exhaustive)}`);
    }
  }
}
