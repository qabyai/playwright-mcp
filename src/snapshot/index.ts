import type { Page } from 'playwright';
import { injectSnapshotHelpers } from './inject';
import {
  addUUIDsToPage,
  extractInteractiveElements,
  getTopElements,
  buildSemanticTree,
  serializeSemanticNode,
} from './semantic-tree';
import { captureScreenshotWithBoundingBoxes } from './bounding-box';
import type { SnapshotResult } from './types';
import { getSelectors } from '../mcp/recording/selector-engine';

// Ensure snapshot helpers are injected into the page
async function ensureSnapshotHelpers(page: Page): Promise<void> {
  const isInjected = await page.evaluate(() => {
    return typeof window.__snapshot !== 'undefined';
  });

  if (!isInjected) {
    await page.evaluate(injectSnapshotHelpers);
  }
}

// Create a rich snapshot of the current page
export async function createSnapshot(page: Page): Promise<SnapshotResult> {
  // 1. Ensure helpers are injected
  await ensureSnapshotHelpers(page);

  // 2. Add UUIDs to all elements
  await addUUIDsToPage(page);

  // 3. Extract interactive elements
  const interactiveElements = await extractInteractiveElements(page);

  // 4. Get all interactive elements (including those outside viewport)
  const allInteractiveElements = await page.evaluate(() => {
    if (!window.__snapshot) {
      throw new Error('Snapshot helpers not injected');
    }

    const uuids: string[] = [];
    window.__snapshot.uuidMap.forEach((element, uuid) => {
      if (
        window.__snapshot!.interactive.isInteractiveElement(element) &&
        window.__snapshot!.visibility.isScrollableIntoView(element)
      ) {
        uuids.push(uuid);
      }
    });

    return Array.from(new Set(uuids));
  });

  // 5. Generate selectors for all interactive elements
  const selectorsMap = new Map<string, string>();
  for (const uuid of allInteractiveElements) {
    try {
      const selectorResult = await getSelectors(page, uuid);
      // Use the first (best) selector from the array
      if (selectorResult.selectors && selectorResult.selectors.length > 0) {
        selectorsMap.set(uuid, selectorResult.selectors[0]);
      }
    } catch (error) {
      // If selector generation fails, continue without selector
      console.warn(`Failed to generate selector for UUID ${uuid}:`, error);
    }
  }

  // 6. Inject selectors into the page context so buildSemanticTree can use them
  await page.evaluate(selectorEntries => {
    if (!window.__snapshot) {
      throw new Error('Snapshot helpers not injected');
    }
    // Store selectors in a global map that buildSemanticTree can access
    window.__snapshot.selectorsMap = new Map(selectorEntries);
  }, Array.from(selectorsMap.entries()));

  // 7. Build semantic tree for all interactive elements (full page)
  const semanticTree = await buildSemanticTree(page, {
    filterByUuids: allInteractiveElements,
    excludeNonScrollableIntoView: false,
  });
  const serializedTree = serializeSemanticNode(semanticTree);

  // 8. Capture annotated screenshot (full page)
  const result = await captureScreenshotWithBoundingBoxes(
    page,
    allInteractiveElements,
    {
      includeAllInteractiveForGroups: true,
      allInteractiveElements: allInteractiveElements,
      selectorsMap: selectorsMap,
    }
  );

  return {
    url: page.url(),
    title: await page.title(),
    semanticTree: serializedTree,
    screenshot: result.screenshot.toString('base64'),
    labelMapping: result.labelMapping || [],
  };
}

// Export types and utilities
export type { SnapshotResult } from './types';
export { injectSnapshotHelpers } from './inject';
export {
  addUUIDsToPage,
  extractInteractiveElements,
  getTopElements,
  buildSemanticTree,
  serializeSemanticNode,
} from './semantic-tree';
export { captureScreenshotWithBoundingBoxes } from './bounding-box';
export { groupInteractiveElements } from './element-grouping';
