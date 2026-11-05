import type { Page } from 'playwright';
import { groupInteractiveElements } from './element-grouping';
import { screenshotWithDOMAnnotations } from './dom-annotations';
import type { ElementBounds, ElementGroup, BoundingBoxResult } from './types';

// Filter nested elements and prioritize content elements
function filterNestedElements(
  bounds: ElementBounds[],
  viewportHeight: number = 800
): ElementBounds[] {
  if (bounds.length <= 1) return bounds;

  interface ScoredElementBounds extends ElementBounds {
    importance: number;
  }

  const scoredBounds: ScoredElementBounds[] = bounds.map(bound => ({
    ...bound,
    importance: 100, // Equal importance for all elements
  }));

  const minImportanceThreshold = 30;
  const importantBounds = scoredBounds.filter(
    bound => bound.importance >= minImportanceThreshold
  );

  const finalBounds: ScoredElementBounds[] =
    importantBounds.length > 0
      ? importantBounds
      : scoredBounds
          .sort((a, b) => b.importance - a.importance)
          .slice(0, Math.min(8, bounds.length));

  const sortedBounds = finalBounds.sort((a, b) => {
    const importanceDiff = b.importance - a.importance;
    if (Math.abs(importanceDiff) > 10) return importanceDiff;
    return b.width * b.height - a.width * a.height;
  });

  const totalArea = sortedBounds.reduce(
    (sum, bound) => sum + bound.width * bound.height,
    0
  );
  const avgArea = totalArea / sortedBounds.length;
  const minAreaThreshold = avgArea * 0.1;

  const contains = (a: ElementBounds, b: ElementBounds): boolean => {
    return (
      a.left <= b.left &&
      a.top <= b.top &&
      a.left + a.width >= b.left + b.width &&
      a.top + a.height >= b.top + b.height
    );
  };

  const hasSignificantOverlap = (
    a: ElementBounds,
    b: ElementBounds,
    threshold: number
  ): boolean => {
    const overlapLeft = Math.max(a.left, b.left);
    const overlapTop = Math.max(a.top, b.top);
    const overlapRight = Math.min(a.left + a.width, b.left + b.width);
    const overlapBottom = Math.min(a.top + a.height, b.top + b.height);

    if (overlapRight <= overlapLeft || overlapBottom <= overlapTop)
      return false;

    const overlapArea =
      (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
    const smallerArea = Math.min(a.width * a.height, b.width * b.height);

    return overlapArea / smallerArea >= threshold;
  };

  const filtered: ScoredElementBounds[] = [];

  for (const bound of sortedBounds) {
    const area = bound.width * bound.height;
    if (area < minAreaThreshold && bound.importance < 80) continue;

    const isNested = filtered.some(selected => {
      if (selected.importance > bound.importance + 20) {
        return (
          contains(selected, bound) ||
          hasSignificantOverlap(selected, bound, 0.6)
        );
      }
      return (
        contains(selected, bound) || hasSignificantOverlap(selected, bound, 0.8)
      );
    });

    if (!isNested) {
      filtered.push(bound);
    }
  }

  return filtered.map(({ importance: _importance, ...bound }) => bound);
}

// Capture screenshot with bounding boxes drawn around interactive elements
export async function captureScreenshotWithBoundingBoxes(
  page: Page,
  interactableElements: string[],
  options?: {
    includeAllInteractiveForGroups?: boolean;
    allInteractiveElements?: string[];
    selectorsMap?: Map<string, string>;
  }
): Promise<BoundingBoxResult> {
  const validUuids = interactableElements.filter(
    uuid => uuid && uuid.length > 5 && uuid !== 'no-uuid-found'
  );

  // Group elements if there are many of them
  let groupingResult = null;
  const USE_GROUPING_THRESHOLD = 15;

  if (validUuids.length > USE_GROUPING_THRESHOLD) {
    const elementsForGrouping =
      options?.includeAllInteractiveForGroups && options?.allInteractiveElements
        ? options.allInteractiveElements.filter(
            uuid => uuid && uuid.length > 5 && uuid !== 'no-uuid-found'
          )
        : validUuids;

    groupingResult = await groupInteractiveElements(page, elementsForGrouping);
  }

  // Get element bounds
  const evaluateParams = {
    uuids: groupingResult ? groupingResult.ungroupedElements : validUuids,
    groups: groupingResult ? groupingResult.groups : null,
  };

  const elementBounds = await page.evaluate(
    ({ uuids, groups }: { uuids: string[]; groups: ElementGroup[] | null }) => {
      if (!window.__snapshot) {
        throw new Error('Snapshot helpers not injected');
      }

      const bounds: ElementBounds[] = [];
      const colors = [
        '#FF0000',
        '#00FF00',
        '#0000FF',
        '#FFA500',
        '#800080',
        '#008080',
        '#FF69B4',
        '#4B0082',
        '#FF4500',
        '#2E8B57',
      ];

      const isIndependentInteractive = (element: Element): boolean => {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
        if (!window.__snapshot!.visibility.isElementVisible(element))
          return false;
        if (!window.__snapshot!.visibility.isElementInExpandedViewport(element))
          return false;
        if (!window.__snapshot!.visibility.isTopElement(element)) return false;

        const hasInteractiveAttributes =
          element.hasAttribute('role') ||
          element.hasAttribute('tabindex') ||
          element.hasAttribute('onclick') ||
          typeof (element as any).onclick === 'function';

        const hasInteractiveClass =
          /\b(btn|clickable|menu|item|entry|link)\b/i.test(
            element.className || ''
          );

        const isParentBody =
          element.parentElement &&
          element.parentElement.isSameNode(document.body);

        const hasPointerCursor = (el: Element): boolean => {
          const styles = window.getComputedStyle(el);
          return (
            styles.cursor === 'pointer' ||
            el.classList.contains('cursor-pointer')
          );
        };

        const isButtonOrLinkTag = (el: Element): boolean => {
          const tag = el.tagName.toLowerCase();
          return tag === 'button' || tag === 'a';
        };

        const isInsideInteractiveElement = (() => {
          let parent = element.parentElement;
          while (parent && parent !== document.body) {
            if (isButtonOrLinkTag(parent) || hasPointerCursor(parent)) {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        })();

        const isInteractiveElement =
          isButtonOrLinkTag(element) ||
          (hasPointerCursor(element) && !isInsideInteractiveElement);

        const isBasicallyInteractive =
          window.__snapshot!.interactive.isInteractiveElement(element) ||
          hasInteractiveAttributes ||
          hasInteractiveClass;

        if (!isBasicallyInteractive || isParentBody) {
          return false;
        }

        if (isInteractiveElement) return true;
        if (isInsideInteractiveElement) return false;

        return true;
      };

      let colorIndex = 0;
      let elementIndex = 0;
      const processedUuids = new Set<string>();

      // Process groups first
      if (groups && groups.length > 0) {
        groups.forEach(group => {
          if (group.bounds) {
            const labelNumber = elementIndex + 1;

            if (
              group.bounds.left < 0 ||
              group.bounds.top < 0 ||
              group.bounds.left > window.innerWidth ||
              group.bounds.top > window.innerHeight ||
              group.bounds.left + group.bounds.width < 0 ||
              group.bounds.top + group.bounds.height < 0
            ) {
              return;
            }

            bounds.push({
              top: group.bounds.top,
              left: group.bounds.left,
              width: group.bounds.width,
              height: group.bounds.height,
              uuid: group.label,
              isGroup: true,
              color: colors[colorIndex % colors.length] || '#007acc',
              label: labelNumber.toString(),
            });
            colorIndex++;
            elementIndex++;

            group.elements.forEach((uuid: string) => {
              const element = window.__snapshot!.uuidMap.get(uuid);
              if (element) {
                const rect = element.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  bounds.push({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    uuid: uuid,
                    isGroup: false,
                    color: colors[colorIndex % colors.length] || '#007acc',
                    label: '',
                  });
                }
              }
              processedUuids.add(uuid);
            });
          }
        });

        // Process ungrouped elements
        const ungroupedUuids = uuids.filter(uuid => !processedUuids.has(uuid));
        const filteredUngroupedUuids = ungroupedUuids.filter(uuid => {
          const element = window.__snapshot!.uuidMap.get(uuid);
          if (!element) return false;
          return isIndependentInteractive(element);
        });

        filteredUngroupedUuids.forEach(uuid => {
          const element = window.__snapshot!.uuidMap.get(uuid);
          if (!element) return;

          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          const labelNumber = elementIndex + 1;

          bounds.push({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            uuid: uuid,
            isGroup: false,
            color: colors[colorIndex % colors.length] || '#007acc',
            label: labelNumber.toString(),
          });
          colorIndex++;
          elementIndex++;
        });
      } else {
        // No grouping, process all elements individually
        const filteredUuids = uuids.filter(uuid => {
          const element = window.__snapshot!.uuidMap.get(uuid);
          if (!element) return false;
          return isIndependentInteractive(element);
        });

        filteredUuids.forEach(uuid => {
          const element = window.__snapshot!.uuidMap.get(uuid);
          if (!element) return;

          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          const labelNumber = elementIndex + 1;

          bounds.push({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            uuid: uuid,
            isGroup: false,
            color: colors[colorIndex % colors.length] || '#007acc',
            label: labelNumber.toString(),
          });
          colorIndex++;
          elementIndex++;
        });
      }

      return bounds;
    },
    evaluateParams
  );

  // Get viewport dimensions for filtering
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentWidth: Math.max(
      document.documentElement.scrollWidth,
      window.innerWidth
    ),
    documentHeight: Math.max(
      document.documentElement.scrollHeight,
      window.innerHeight
    ),
  }));

  const screenshotData = {
    width: dimensions.documentWidth,
    height: dimensions.documentHeight,
    viewportDimensions: {
      width: dimensions.viewportWidth,
      height: dimensions.viewportHeight,
    },
  };

  // Filter nested elements
  const viewportHeight = screenshotData?.viewportDimensions?.height || 800;
  const filteredElementBounds = filterNestedElements(
    elementBounds,
    viewportHeight
  );

  // Take screenshot with DOM annotations
  const annotatedScreenshot = await screenshotWithDOMAnnotations(
    page,
    filteredElementBounds,
    true // full page
  );

  // Create label mapping as a properly formatted string
  // This maps the numeric labels shown in the screenshot to element identifiers
  // Each label corresponds to an interactive element that can be clicked/interacted with
  const labelLines: string[] = [];

  // Add header description
  labelLines.push('Interactive elements in screenshot:');

  elementBounds.forEach(bound => {
    if (bound.label) {
      // Get the selector for this UUID if available
      const selector = options?.selectorsMap?.get(bound.uuid);
      if (selector) {
        // Include both UUID and selector
        labelLines.push(
          `Label ${bound.label} = ${bound.uuid} | selector: ${selector}`
        );
      } else {
        // Fallback to just UUID if no selector available
        labelLines.push(`Label ${bound.label} = ${bound.uuid}`);
      }
    }
  });

  // Join with actual newlines for proper formatting
  const labelMapping = labelLines.join('\n');

  return {
    screenshot: annotatedScreenshot,
    groups: groupingResult?.groups,
    labelMapping,
    dimensions: {
      screenshot: {
        width: screenshotData.width,
        height: screenshotData.height,
      },
      viewport: screenshotData.viewportDimensions,
    },
  };
}
