import type { Page } from 'playwright';
import { injectSnapshotHelpers } from './inject';
import {
  addUUIDsToPage,
  buildSemanticTree,
  serializeSemanticNode,
} from './semantic-tree';
import type { SnapshotResult } from './types';

async function ensureSnapshotHelpers(page: Page): Promise<void> {
  const isInjected = await page.evaluate(() => {
    return typeof window.__snapshot !== 'undefined';
  });

  if (!isInjected) {
    await page.evaluate(injectSnapshotHelpers);
  }
}

export async function createFullSnapshot(page: Page): Promise<SnapshotResult> {
  await ensureSnapshotHelpers(page);
  await addUUIDsToPage(page);

  const semanticTree = await buildSemanticTree(page, {
    excludeNonVisible: true,
    excludeNonScrollableIntoView: false,
    excludeNonInteractive: false,
    excludeNonTopElements: false,
    hierarchy: 'full',
  });

  const serializedTree = serializeSemanticNode(semanticTree, {
    skipHierarchyNodeContent: false,
    skipNonVisibleElements: true,
    includeUuid: 'all',
    includeRole: true,
    includeAttributes: true,
    includeDeductedName: true,
    includeAdditionalInfo: true,
    includeInteractive: true,
    includeVisibility: true,
  });

  const screenshot = await page.screenshot({ type: 'png' });

  return {
    url: page.url(),
    title: await page.title(),
    semanticTree: serializedTree,
    screenshot: screenshot.toString('base64'),
    labelMapping: [],
  };
}
