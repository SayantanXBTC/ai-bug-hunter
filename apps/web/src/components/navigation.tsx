import type { SVGProps } from 'react';
import type { UserRole } from '@ai-bug-hunter/shared';
import {
  IconActivity,
  IconBug,
  IconCog,
  IconLayers,
  IconList,
  IconRadar,
  IconSparkles,
  IconTarget,
} from './icons.js';

export type ViewId =
  | 'dashboard'
  | 'applications'
  | 'tests'
  | 'test-runs'
  | 'bugs'
  | 'reliability'
  | 'regression'
  | 'settings';

/** One-shot actions a page can open on arrival (from quick actions or the command palette). */
export type PageAction = 'add-application' | 'generate-tests' | 'create-campaign' | 'analyze-bugs';

export type NavGroup = 'overview' | 'build' | 'analyze' | 'system';

export interface NavEntry {
  id: ViewId;
  label: string;
  /** Short line under the label in the sidebar. */
  blurb: string;
  group: NavGroup;
  /** Position in the core QA workflow, shown as a numbered step. */
  step?: number;
  minRole?: UserRole;
  icon: (p: SVGProps<SVGSVGElement> & { size?: number }) => JSX.Element;
  guide: { summary: string; steps: string[]; tip?: string };
}

export const NAV_GROUP_LABEL: Record<NavGroup, string> = {
  overview: 'Overview',
  build: 'Test workflow',
  analyze: 'Insights',
  system: 'System',
};

export const NAV_ENTRIES: NavEntry[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    blurb: 'Health at a glance',
    group: 'overview',
    icon: IconActivity,
    guide: {
      summary: 'Your QA command centre. Every number here comes from real test runs.',
      steps: [
        'Follow the getting-started checklist until every step is ticked.',
        'Watch the quality score: it combines pass rate, regressions, flaky tests and unresolved bug clusters.',
        'Click any metric tile to jump to the page that explains it.',
      ],
      tip: 'Press ⌘K (Ctrl K on Windows) anywhere to jump to a page or start an action.',
    },
  },
  {
    id: 'applications',
    label: 'Applications',
    blurb: 'Add & crawl your apps',
    group: 'build',
    step: 1,
    icon: IconLayers,
    guide: {
      summary: 'Register the web apps you want tested, then let the crawler map them.',
      steps: [
        'Click "Add application" and paste the public URL of your app.',
        'Press "Discover" to crawl it in real Chromium: pages, forms and selectors are mapped.',
        'From the discovery result, generate AI tests for that application.',
      ],
      tip: 'Private, localhost and internal network URLs are blocked for safety.',
    },
  },
  {
    id: 'tests',
    label: 'Tests',
    blurb: 'Generate & run tests',
    group: 'build',
    step: 2,
    minRole: 'qa_engineer',
    icon: IconSparkles,
    guide: {
      summary: 'Your test library. AI writes the tests, deterministic code validates every step.',
      steps: [
        'Click "Generate Tests", pick an application and a goal (smoke, functional, negative…).',
        'Review the proposed tests and save the ones you want.',
        'Press "Run Test" on any row. Results and evidence appear under Test Runs.',
      ],
      tip: 'Open a test to edit steps, disable it, or see its reliability history.',
    },
  },
  {
    id: 'test-runs',
    label: 'Test Runs',
    blurb: 'Results & evidence',
    group: 'build',
    step: 3,
    icon: IconList,
    guide: {
      summary: 'Every execution with step-by-step results, screenshots, DOM, console and network logs.',
      steps: [
        'Filter by status to find failures quickly.',
        'Open a run to see which step broke and the evidence captured at that moment.',
        'On a failed run, start an AI investigation to get a root-cause hypothesis.',
      ],
    },
  },
  {
    id: 'bugs',
    label: 'Bugs',
    blurb: 'AI-clustered failures',
    group: 'analyze',
    icon: IconBug,
    guide: {
      summary: 'Groups failures that share a root cause, so one bug is not reported ten times.',
      steps: [
        'Run some tests first. Failures are the raw material for clustering.',
        'Press "Analyze failures". Fingerprints and similarity scoring group related runs.',
        'Open a cluster to see its members, timeline and the AI root-cause summary.',
      ],
      tip: 'The AI is only consulted for ambiguous pairs. Clear matches are decided by code.',
    },
  },
  {
    id: 'reliability',
    label: 'Reliability',
    blurb: 'Flaky test detection',
    group: 'analyze',
    icon: IconRadar,
    guide: {
      summary: 'Separates tests that are truly broken from tests that are merely flaky.',
      steps: [
        'Run each test several times. Classification needs a minimum number of runs.',
        'Press "Recalculate" to refresh the classification from the latest history.',
        'Use the stability matrix to spot tests that alternate between pass and fail.',
      ],
    },
  },
  {
    id: 'regression',
    label: 'Regression',
    blurb: 'Batch campaigns',
    group: 'analyze',
    icon: IconTarget,
    guide: {
      summary: 'Run a curated batch of tests together and get one quality verdict.',
      steps: [
        'Click "Create campaign" and choose a selection strategy and test budget.',
        'Review the selected tests. Nothing runs until you press "Run campaign".',
        'Read the verdict: healthy, degraded, failed or inconclusive.',
      ],
      tip: 'CI pipelines can trigger the same campaigns with a token from Settings.',
    },
  },
  {
    id: 'settings',
    label: 'Settings',
    blurb: 'Theme, account, CI',
    group: 'system',
    icon: IconCog,
    guide: {
      summary: 'Appearance, account details and, for admins, AI engine, CI tokens and retention.',
      steps: [
        'Pick dark or light mode. The choice is saved on this device.',
        'Admins can create CI tokens to trigger regression campaigns from pipelines.',
      ],
    },
  },
];

const ROLE_ORDER: Record<UserRole, number> = { viewer: 0, qa_engineer: 1, admin: 2 };

export function visibleEntries(role: UserRole): NavEntry[] {
  return NAV_ENTRIES.filter((e) => !e.minRole || ROLE_ORDER[role] >= ROLE_ORDER[e.minRole]);
}

export function entryFor(id: ViewId): NavEntry {
  return NAV_ENTRIES.find((e) => e.id === id) ?? NAV_ENTRIES[0]!;
}
