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

export async function createTextSnapshot(page: Page): Promise<SnapshotResult> {
  await ensureSnapshotHelpers(page);
  await addUUIDsToPage(page);

  const textElements = await page.evaluate(() => {
    if (!window.__snapshot) {
      throw new Error('Snapshot helpers not injected');
    }

    const TEXT_TAGS = new Set([
      'p',
      'span',
      'div',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'li',
      'td',
      'th',
      'dt',
      'dd',
      'blockquote',
      'pre',
      'code',
      'article',
      'section',
      'main',
      'label',
      'caption',
      'figcaption',
    ]);

    const uuids: string[] = [];

    window.__snapshot.uuidMap.forEach((element, uuid) => {
      const tagName = element.tagName.toLowerCase();

      const hasText =
        element.textContent && element.textContent.trim().length > 0;
      const isTextElement =
        TEXT_TAGS.has(tagName) ||
        element.getAttribute('role') === 'heading' ||
        element.getAttribute('role') === 'text';

      if (hasText && (isTextElement || element.childElementCount === 0)) {
        uuids.push(uuid);
      }
    });

    return Array.from(new Set(uuids));
  });

  const semanticTree = await buildSemanticTree(page, {
    filterByUuids: textElements,
    excludeNonVisible: true,
    hierarchy: 'minimal',
  });

  const serializedTree = serializeSemanticNode(semanticTree, {
    skipHierarchyNodeContent: false,
    skipNonVisibleElements: true,
    includeUuid: 'none',
    includeRole: false,
    includeAttributes: false,
    includeDeductedName: false,
    includeAdditionalInfo: false,
    includeInteractive: false,
    includeVisibility: false,
    maxNodeTextLength: 5000,
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
