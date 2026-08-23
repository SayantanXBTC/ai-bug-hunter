import { randomUUID } from 'node:crypto';
import { BrowserManager } from '../browser/browserManager.js';
import { logger } from '../logger.js';
import { inspectPage } from './pageInspector.js';
import {
  DEFAULT_DISCOVERY_OPTIONS,
  type DiscoveryOptions,
  type DiscoveryResult,
  type DiscoveryWarning,
  type PageModel,
  type ResolvedDiscoveryOptions,
} from './discoveryTypes.js';
import { isInScope, normalizeUrl, tryParseUrl } from './urlNormalizer.js';

export interface DiscoveryEngineOptions {
  browserManager?: BrowserManager;
}

interface QueueItem {
  url: string;
  depth: number;
}

export class DiscoveryEngine {
  private readonly externalManager: BrowserManager | undefined;

  constructor(opts: DiscoveryEngineOptions = {}) {
    this.externalManager = opts.browserManager;
  }

  async discover(input: DiscoveryOptions): Promise<DiscoveryResult> {
    const opts = resolveOptions(input);
    const startBase = tryParseUrl(opts.baseUrl);
    if (!startBase) throw new Error(`Invalid baseUrl: ${opts.baseUrl}`);

    const startedMs = Date.now();
    const warnings: DiscoveryWarning[] = [];
    const pages: PageModel[] = [];
    const visited = new Set<string>();
    const queue: QueueItem[] = [{ url: normalizeUrl(startBase), depth: 0 }];

    const manager =
      this.externalManager ?? new BrowserManager({ headless: opts.headless });
    const ownManager = this.externalManager === undefined;
    const session = await (async () => {
      await manager.launch();
      return manager.createSession();
    })();

    let linksFound = 0;
    let interactiveElements = 0;
    let forms = 0;

    logger.info('discovery:start', {
      baseUrl: opts.baseUrl,
      maxPages: opts.maxPages,
      maxDepth: opts.maxDepth,
    });

    try {
      while (queue.length > 0) {
        if (pages.length >= opts.maxPages) {
          warnings.push({ kind: 'max_pages_reached', message: `maxPages=${opts.maxPages}` });
          break;
        }
        const next = queue.shift()!;
        if (visited.has(next.url)) {
          warnings.push({ kind: 'duplicate_url', message: 'already visited', url: next.url });
          continue;
        }
        visited.add(next.url);

        const parsed = tryParseUrl(next.url);
        if (!parsed) continue;
        if (
          !isInScope(parsed, {
            baseUrl: startBase,
            sameOriginOnly: opts.sameOriginOnly,
            allowedHosts: opts.allowedHosts,
          })
        ) {
          warnings.push({ kind: 'blocked_external', message: 'out of scope', url: next.url });
          continue;
        }

        logger.debug('discovery:visit', { url: next.url, depth: next.depth });

        try {
          const response = await session.page.goto(next.url, {
            timeout: opts.navigationTimeoutMs,
            waitUntil: 'domcontentloaded',
          });
          const finalUrlRaw = session.page.url();
          const finalUrl = tryParseUrl(finalUrlRaw);
          if (
            finalUrl &&
            !isInScope(finalUrl, {
              baseUrl: startBase,
              sameOriginOnly: opts.sameOriginOnly,
              allowedHosts: opts.allowedHosts,
            })
          ) {
            warnings.push({
              kind: 'redirect_out_of_scope',
              message: `${next.url} redirected to ${finalUrlRaw}`,
              url: next.url,
            });
            continue;
          }
          if (response && response.status() >= 400) {
            warnings.push({
              kind: 'inspect_failed',
              message: `HTTP ${response.status()}`,
              url: next.url,
            });
            continue;
          }
          if (opts.pageSettleMs > 0) await session.page.waitForTimeout(opts.pageSettleMs);

          const model = await inspectPage(session.page, opts);
          pages.push(model);
          linksFound += model.links.length;
          interactiveElements += model.elements.length;
          forms += model.forms.length;

          if (next.depth < opts.maxDepth) {
            for (const link of model.links) {
              if (!link.inScope) continue;
              if (visited.has(link.normalizedUrl)) continue;
              if (queue.some((q) => q.url === link.normalizedUrl)) continue;
              queue.push({ url: link.normalizedUrl, depth: next.depth + 1 });
            }
          } else {
            warnings.push({
              kind: 'max_depth_reached',
              message: `depth=${next.depth}`,
              url: next.url,
            });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const kind = /timeout/i.test(message) ? 'navigation_timeout' : 'inspect_failed';
          warnings.push({ kind, message, url: next.url });
          logger.warn('discovery:page-failed', { url: next.url, error: message });
        }
      }
    } finally {
      await session.close();
      if (ownManager) await manager.close();
    }

    const result: DiscoveryResult = {
      application: {
        id: randomUUID(),
        baseUrl: opts.baseUrl,
        discoveredAt: new Date(startedMs).toISOString(),
        pages,
      },
      stats: {
        pagesVisited: visited.size,
        pagesDiscovered: pages.length,
        linksFound,
        interactiveElements,
        forms,
        crawlDurationMs: Date.now() - startedMs,
      },
      warnings,
    };

    logger.info('discovery:complete', {
      baseUrl: opts.baseUrl,
      pagesDiscovered: pages.length,
      warnings: warnings.length,
      durationMs: result.stats.crawlDurationMs,
    });

    return result;
  }
}

function resolveOptions(input: DiscoveryOptions): ResolvedDiscoveryOptions {
  return {
    ...DEFAULT_DISCOVERY_OPTIONS,
    ...stripUndefined(input),
    baseUrl: input.baseUrl,
    allowedHosts: input.allowedHosts ?? DEFAULT_DISCOVERY_OPTIONS.allowedHosts,
  };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
