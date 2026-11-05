import type { Page } from 'playwright';
import type { ElementGroup, GroupingResult } from './types';

// Detect dense areas and group interactive elements hierarchically
export async function groupInteractiveElements(
  page: Page,
  interactableElements: string[]
): Promise<GroupingResult> {
  return await page.evaluate(
    ({ uuids }: { uuids: string[] }) => {
      if (!window.__snapshot) {
        throw new Error('Snapshot helpers not injected');
      }

      const DENSITY_THRESHOLD = 5;
      const PROXIMITY_THRESHOLD = 150;

      const getElementBounds = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
        };
      };

      const findSemanticContainer = (elements: Element[]): Element | null => {
        if (elements.length === 0) return null;

        let commonAncestor = elements[0];
        for (const elem of elements.slice(1)) {
          while (commonAncestor && !commonAncestor.contains(elem)) {
            commonAncestor = commonAncestor.parentElement!;
          }
        }

        const semanticTags = [
          'nav',
          'form',
          'header',
          'footer',
          'aside',
          'menu',
          'toolbar',
        ];
        const semanticRoles = [
          'navigation',
          'form',
          'menu',
          'toolbar',
          'tablist',
          'group',
        ];
        const semanticClasses = [
          'menu',
          'nav',
          'toolbar',
          'sidebar',
          'header',
          'footer',
          'form',
          'calendar',
          'datepicker',
        ];

        while (commonAncestor && commonAncestor !== document.body) {
          const tag = commonAncestor.tagName.toLowerCase();
          const role = commonAncestor.getAttribute('role');
          const classList = Array.from(commonAncestor.classList);

          if (
            semanticTags.includes(tag) ||
            (role && semanticRoles.includes(role)) ||
            classList.some(cls =>
              semanticClasses.some(sc => cls.toLowerCase().includes(sc))
            )
          ) {
            return commonAncestor;
          }

          const ancestorBounds = getElementBounds(commonAncestor);
          const area = ancestorBounds.width * ancestorBounds.height;
          const viewportArea = window.innerWidth * window.innerHeight;

          if (area > viewportArea * 0.5) {
            break;
          }

          commonAncestor = commonAncestor.parentElement!;
        }

        return null;
      };

      const areElementsDense = (elements: Element[]): boolean => {
        if (elements.length < DENSITY_THRESHOLD) return false;

        const bounds = elements.map(getElementBounds);

        const minLeft = Math.min(...bounds.map(b => b.left));
        const minTop = Math.min(...bounds.map(b => b.top));
        const maxRight = Math.max(...bounds.map(b => b.right));
        const maxBottom = Math.max(...bounds.map(b => b.bottom));

        const containerArea = (maxRight - minLeft) * (maxBottom - minTop);
        const elementsTotalArea = bounds.reduce(
          (sum, b) => sum + b.width * b.height,
          0
        );

        const density = elementsTotalArea / containerArea;

        let closeElements = 0;
        for (let i = 0; i < elements.length; i++) {
          for (let j = i + 1; j < elements.length; j++) {
            const b1 = bounds[i];
            const b2 = bounds[j];

            const horizontalDist = Math.max(
              0,
              Math.max(
                (b1?.left || 0) - (b2?.right || 0),
                (b2?.left || 0) - (b1?.right || 0)
              )
            );
            const verticalDist = Math.max(
              0,
              Math.max(
                (b1?.top || 0) - (b2?.bottom || 0),
                (b2?.top || 0) - (b1?.bottom || 0)
              )
            );
            const distance = Math.sqrt(horizontalDist ** 2 + verticalDist ** 2);

            if (distance < PROXIMITY_THRESHOLD) {
              closeElements++;
            }
          }
        }

        const proximityRatio =
          closeElements / ((elements.length * (elements.length - 1)) / 2);

        return density > 0.3 || proximityRatio > 0.5;
      };

      const generateGroupLabel = (
        container: Element | null,
        elements: Element[]
      ): string => {
        if (container) {
          const role = container.getAttribute('role');
          const ariaLabel = container.getAttribute('aria-label');
          const title = container.getAttribute('title');
          const tag = container.tagName.toLowerCase();

          if (ariaLabel) return `${ariaLabel} (${elements.length} items)`;
          if (title) return `${title} (${elements.length} items)`;
          if (role) return `${role} section (${elements.length} items)`;
          if (tag === 'nav') return `Navigation (${elements.length} items)`;
          if (tag === 'form') return `Form (${elements.length} fields)`;
          if (tag === 'menu') return `Menu (${elements.length} items)`;

          const classList = Array.from(container.classList)
            .join(' ')
            .toLowerCase();
          if (classList.includes('calendar'))
            return `Calendar (${elements.length} items)`;
          if (classList.includes('toolbar'))
            return `Toolbar (${elements.length} items)`;
          if (classList.includes('sidebar'))
            return `Sidebar (${elements.length} items)`;
        }

        const buttons = elements.filter(
          e => e.tagName === 'BUTTON' || e.getAttribute('role') === 'button'
        ).length;
        const links = elements.filter(e => e.tagName === 'A').length;
        const inputs = elements.filter(
          e => e.tagName === 'INPUT' || e.tagName === 'TEXTAREA'
        ).length;

        if (buttons > links && buttons > inputs)
          return `Button group (${elements.length} items)`;
        if (links > buttons && links > inputs)
          return `Link group (${elements.length} items)`;
        if (inputs > buttons && inputs > links)
          return `Input group (${elements.length} items)`;

        return `Interactive group (${elements.length} items)`;
      };

      const groups: ElementGroup[] = [];
      const processedUuids = new Set<string>();
      const ungroupedElements = new Set<string>();

      const containerMap = new Map<Element, string[]>();

      for (const uuid of uuids) {
        const element = window.__snapshot!.uuidMap.get(uuid);
        if (!element) continue;

        let container = element.parentElement;
        while (container && container !== document.body) {
          const childrenWithUuids = Array.from(container.children).filter(
            child => uuids.includes(child.getAttribute('uuid') || '')
          );

          if (childrenWithUuids.length >= DENSITY_THRESHOLD) {
            if (!containerMap.has(container)) {
              containerMap.set(container, []);
            }
            containerMap.get(container)!.push(uuid);
            break;
          }

          container = container.parentElement;
        }

        if (!container || container === document.body) {
          ungroupedElements.add(uuid);
        }
      }

      let groupId = 1;
      for (const [container, elementUuids] of containerMap.entries()) {
        if (
          processedUuids.size > 0 &&
          elementUuids.some(uuid => processedUuids.has(uuid))
        ) {
          continue;
        }

        const elements = elementUuids
          .map(uuid => window.__snapshot!.uuidMap.get(uuid))
          .filter(e => e !== undefined) as Element[];

        if (areElementsDense(elements)) {
          const allBounds = elements.map(getElementBounds);
          const spreadMinTop = Math.min(...allBounds.map(b => b.top));
          const spreadMaxTop = Math.max(...allBounds.map(b => b.top));
          const spreadMinLeft = Math.min(...allBounds.map(b => b.left));
          const spreadMaxLeft = Math.max(...allBounds.map(b => b.left));

          const verticalSpread = spreadMaxTop - spreadMinTop;
          const horizontalSpread = spreadMaxLeft - spreadMinLeft;
          const maxSpread = Math.max(verticalSpread, horizontalSpread);

          if (maxSpread > 500) {
            elementUuids.forEach(uuid => ungroupedElements.add(uuid));
            continue;
          }

          const semanticContainer = findSemanticContainer(elements);

          const minLeft = Math.min(...allBounds.map(b => b.left));
          const minTop = Math.min(...allBounds.map(b => b.top));
          const maxRight = Math.max(...allBounds.map(b => b.left + b.width));
          const maxBottom = Math.max(...allBounds.map(b => b.top + b.height));

          const bounds = {
            top: minTop,
            left: minLeft,
            width: maxRight - minLeft,
            height: maxBottom - minTop,
          };

          const group: ElementGroup = {
            id: `group-${groupId++}`,
            type: 'group',
            label: generateGroupLabel(semanticContainer || container, elements),
            elements: elementUuids,
            bounds: {
              top: bounds.top,
              left: bounds.left,
              width: bounds.width,
              height: bounds.height,
            },
          };

          groups.push(group);
          elementUuids.forEach(uuid => processedUuids.add(uuid));
        } else {
          elementUuids.forEach(uuid => ungroupedElements.add(uuid));
        }
      }

      return {
        groups,
        ungroupedElements: Array.from(ungroupedElements),
      };
    },
    { uuids: interactableElements }
  );
}
