import type { Page } from 'playwright';
import type {
  SemanticNode,
  SemanticTreeOptions,
  SemanticTreeSerializeOptions,
} from './types';

// Add UUIDs to all elements in the page
export async function addUUIDsToPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (!window.__snapshot) {
      throw new Error('Snapshot helpers not injected');
    }

    const ELEMENT_NODE = 1;

    const addAttributesToNode = (node: Node): void => {
      if (node.nodeType === ELEMENT_NODE) {
        const element = node as Element;

        let uuid = element.getAttribute('uuid');
        if (!uuid) {
          uuid = window.__snapshot!.generateUUID();
          element.setAttribute('uuid', uuid);
        }

        window.__snapshot!.uuidMap.set(uuid, element);

        for (const child of node.childNodes) {
          addAttributesToNode(child);
        }

        // Traverse shadow DOM if present
        if ((element as HTMLElement).shadowRoot) {
          const shadowRoot = (element as HTMLElement).shadowRoot!;
          for (const shadowChild of shadowRoot.childNodes) {
            addAttributesToNode(shadowChild);
          }
        }
      }
    };

    addAttributesToNode(document.documentElement);
  });
}

// Extract interactive elements from the page
export async function extractInteractiveElements(
  page: Page
): Promise<string[]> {
  return await page.evaluate(() => {
    if (!window.__snapshot) {
      throw new Error('Snapshot helpers not injected');
    }

    const uuids: string[] = [];

    window.__snapshot.uuidMap.forEach((element, uuid) => {
      if (window.__snapshot!.interactive.isInteractiveElement(element)) {
        uuids.push(uuid);
      }
    });

    return Array.from(new Set(uuids));
  });
}

// Get top (non-occluded) elements
export async function getTopElements(
  page: Page,
  uuids: string[]
): Promise<string[]> {
  return await page.evaluate(
    ({ uuids }) => {
      if (!window.__snapshot) {
        throw new Error('Snapshot helpers not injected');
      }

      return uuids.filter(uuid => {
        const element = window.__snapshot!.uuidMap.get(uuid);
        if (!element) return false;
        return window.__snapshot!.visibility.isTopElement(element);
      });
    },
    { uuids }
  );
}

// Build semantic tree in browser context
export async function buildSemanticTree(
  page: Page,
  options: SemanticTreeOptions = {}
): Promise<SemanticNode> {
  return await page.evaluate((options: SemanticTreeOptions) => {
    if (!window.__snapshot) {
      throw new Error('Snapshot helpers not injected');
    }

    const EMPTY_NODE: SemanticNode = { tagName: 'body', children: [] };

    const EXCLUDED_TAGS = new Set([
      'script',
      'style',
      'link',
      'meta',
      'noscript',
    ]);

    const STRUCTURAL_ELEMENTS = new Set([
      'html',
      'body',
      'nav',
      'header',
      'footer',
      'main',
      'article',
      'section',
      'aside',
      'dialog',
      'form',
      'table',
    ]);

    const EXCLUDED_SVG_ELEMENTS = new Set([
      'path',
      'rect',
      'circle',
      'line',
      'polyline',
      'polygon',
      'g',
      'text',
      'ellipse',
      'tspan',
      'use',
      'defs',
      'symbol',
      'linearGradient',
      'radialGradient',
      'pattern',
      'filter',
    ]);

    // Helper functions
    const extractElementName = (element: Element): string | null => {
      return (
        element.getAttribute('aria-label') ||
        element.getAttribute('label') ||
        element.getAttribute('title') ||
        element.getAttribute('name') ||
        null
      );
    };

    const sanitizeUrl = (url: string, maxLength: number = 200): string => {
      if (!url) return url;
      if (url.startsWith('data:')) return '[data-url]';
      if (url.length > maxLength) return url.substring(0, maxLength) + '...';
      return url;
    };

    const isStructuralElement = (element: Element): boolean => {
      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      return (
        STRUCTURAL_ELEMENTS.has(tagName) || STRUCTURAL_ELEMENTS.has(role || '')
      );
    };

    const extractDirectText = (element: Element): string => {
      return Array.from(element.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent?.trim())
        .filter(text => text && text.length > 0)
        .join(' ');
    };

    interface InternalNode {
      element: Element;
      parent: InternalNode | null;
      children: InternalNode[];
      isKeeper: boolean;
      isStructural: boolean;
      shouldPrune: boolean;
    }

    const extractNestedText = (internalNode: InternalNode): string => {
      const element = internalNode.element;
      const directText = extractDirectText(element);
      const nestedText = Array.from(internalNode.children)
        .filter(node => node.shouldPrune)
        .map(node => node.element.textContent?.split('\n').join(' ').trim())
        .filter(text => text && text.length > 0)
        .join(' ');
      return [directText, nestedText].filter(Boolean).join(' ');
    };

    const extractElementContent = (
      internalNode: InternalNode
    ): {
      value?: string;
      attributes?: string;
      additionalInfo?: string;
      nestedText?: string;
    } => {
      const element = internalNode.element;
      const tagName = element.tagName.toLowerCase();
      const result: {
        value?: string;
        attributes?: string;
        additionalInfo?: string;
        nestedText?: string;
      } = {};

      const nestedText = extractNestedText(internalNode);

      switch (tagName) {
        case 'input': {
          const input = element as HTMLInputElement;
          const type = input.type.toLowerCase();
          const attrs: string[] = [`type=${type}`];
          if (input.name) attrs.push(`name=${input.name}`);
          if (input.placeholder) attrs.push(`placeholder=${input.placeholder}`);

          if (type === 'checkbox' || type === 'radio') {
            result.value = input.checked ? 'checked' : 'unchecked';
          } else if (type !== 'hidden' && input.value) {
            result.value = input.value;
          }

          result.attributes = attrs.join('; ');
          break;
        }

        case 'select': {
          const select = element as HTMLSelectElement;
          const selectedOptions = Array.from(select.selectedOptions);
          if (selectedOptions.length > 0) {
            result.additionalInfo =
              'options=' +
              Array.from(select.querySelectorAll('option'))
                .map(option => option.textContent || '')
                .join(', ');
            result.value = selectedOptions.map(opt => opt.text).join(', ');
          }
          break;
        }

        case 'textarea': {
          const textarea = element as HTMLTextAreaElement;
          if (textarea.value) result.value = textarea.value;
          break;
        }

        case 'img': {
          const img = element as HTMLImageElement;
          if (img.alt) result.value = img.alt;
          if (img.src)
            result.attributes = `src=${sanitizeUrl(img.src)}; alt=${img.alt || ''}`;
          break;
        }

        case 'a': {
          const link = element as HTMLAnchorElement;
          result.value = nestedText || undefined;
          if (link.href) result.attributes = `href=${sanitizeUrl(link.href)}`;
          break;
        }

        case 'button': {
          const button = element as HTMLButtonElement;
          result.value = button.textContent?.trim() || undefined;
          break;
        }

        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
          result.value = element.textContent?.trim() || undefined;
          break;
        }

        case 'svg': {
          const svg = element as SVGSVGElement;
          const titleElement = svg.querySelector('title');
          const ariaLabel = svg.getAttribute('aria-label');
          result.value =
            ariaLabel || titleElement?.textContent?.trim() || undefined;
          break;
        }

        default: {
          const ariaLabel = element.getAttribute('aria-label');
          result.value = [nestedText, ariaLabel].filter(Boolean).join(' ');
        }
      }

      result.nestedText = nestedText;
      return result;
    };

    function buildSemanticNode(
      internalNode: InternalNode
    ): SemanticNode | undefined {
      const element = internalNode.element;
      const tagName = element.tagName.toLowerCase();

      const id = element.getAttribute('uuid') || undefined;
      const visible = window.__snapshot!.visibility.isElementVisible(element);
      const interactive =
        window.__snapshot!.interactive.isInteractiveElement(element);
      const scrollableIntoView =
        window.__snapshot!.visibility.isScrollableIntoView(element);

      const contentInfo = extractElementContent(internalNode);

      // Get selector from selectorsMap if available
      const selector =
        (id && window.__snapshot?.selectorsMap?.get(id)) || undefined;

      const node: SemanticNode = {
        id,
        tagName,
        children: [],
        isHierarchyNode: !internalNode.isKeeper,
        role: element.getAttribute('role') || undefined,
        deductedName: extractElementName(element) || undefined,
        selector,
        visible,
        interactive,
        scrollableIntoView,
        ...contentInfo,
      };

      // Add bounding box for interactive elements
      if (id && interactive) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          node.boundingBox = {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }
      }

      return node;
    }

    function getAllElementsWithUuid(
      root: Document | ShadowRoot | Element
    ): Element[] {
      const elements: Element[] = [];
      const localElements = Array.from(root.querySelectorAll('[uuid]'));
      elements.push(...localElements);

      if (root instanceof Element && root.hasAttribute('uuid')) {
        elements.push(root);
      }

      const allElements = Array.from(root.querySelectorAll('*'));
      for (const el of allElements) {
        if (el.shadowRoot) {
          elements.push(...getAllElementsWithUuid(el.shadowRoot));
        }
      }

      return elements;
    }

    function getFilteredElements(options: SemanticTreeOptions): Set<Element> {
      const elementsToInclude: Set<Element> = new Set();
      let allElementsWithUuid = getAllElementsWithUuid(document);

      if (options.filterByUuids && options.filterByUuids.length > 0) {
        const uuidSet = new Set(options.filterByUuids);
        allElementsWithUuid = allElementsWithUuid.filter(el => {
          const uuid = el.getAttribute('uuid');
          return uuid && uuidSet.has(uuid);
        });
      }

      if (options.excludeNonVisible) {
        allElementsWithUuid = allElementsWithUuid.filter(el =>
          window.__snapshot!.visibility.isElementVisible(el)
        );
      }

      if (options.excludeNonScrollableIntoView) {
        allElementsWithUuid = allElementsWithUuid.filter(el =>
          window.__snapshot!.visibility.isScrollableIntoView(el)
        );
      }

      if (options.excludeNonInteractive) {
        allElementsWithUuid = allElementsWithUuid.filter(el =>
          window.__snapshot!.interactive.isInteractiveElement(el, {
            elementTypes: options.elementTypes,
            includeDisabledElements: options.includeDisabledElements,
          })
        );
      }

      if (options.excludeNonTopElements) {
        allElementsWithUuid = allElementsWithUuid.filter(el =>
          window.__snapshot!.visibility.isTopElement(el)
        );
      }

      if (options.excludeEmptyTextElements) {
        allElementsWithUuid = allElementsWithUuid.filter(el => {
          const directText = Array.from(el.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent?.trim())
            .filter(text => text && text.length > 0)
            .join(' ');
          return directText.trim().length > 0;
        });
      }

      allElementsWithUuid.forEach(el => elementsToInclude.add(el));
      return elementsToInclude;
    }

    function buildInternalTree(
      elementsToInclude: Set<Element>
    ): InternalNode | null {
      const nodeMap = new Map<Element, InternalNode>();

      function buildNode(element: Element): InternalNode {
        if (nodeMap.has(element)) {
          return nodeMap.get(element)!;
        }

        const node: InternalNode = {
          element: element,
          parent: null,
          children: [],
          isKeeper: elementsToInclude.has(element),
          isStructural: isStructuralElement(element),
          shouldPrune: false,
        };
        nodeMap.set(element, node);

        const processChildren = (children: HTMLCollection) => {
          for (const child of children) {
            const childTagName = child.tagName.toLowerCase();
            if (
              EXCLUDED_TAGS.has(childTagName) ||
              EXCLUDED_SVG_ELEMENTS.has(childTagName)
            ) {
              continue;
            }

            const childNode = buildNode(child);
            childNode.parent = node;
            node.children.push(childNode);
          }
        };

        processChildren(element.children);

        if ((element as HTMLElement).shadowRoot) {
          processChildren((element as HTMLElement).shadowRoot!.children);
        }

        return node;
      }

      return buildNode(document.documentElement);
    }

    function markNodesForPruning(
      root: InternalNode | null,
      hierarchyMode: 'full' | 'important' | 'minimal'
    ): void {
      if (!root) return;

      function markNonRelevantNodes(node: InternalNode): boolean {
        let hasKeeperDescendant = false;

        for (const child of node.children) {
          if (markNonRelevantNodes(child)) {
            hasKeeperDescendant = true;
          }
        }

        if (node.isKeeper) {
          hasKeeperDescendant = true;
        }

        if (node.shouldPrune) return false;

        if (!hasKeeperDescendant) {
          node.shouldPrune = true;
          return false;
        }

        return hasKeeperDescendant;
      }

      markNonRelevantNodes(root);

      if (hierarchyMode === 'full') return;

      function getLeafNodes(node: InternalNode): InternalNode[] {
        if (node.children.length === 0) return [node];
        const leaves: InternalNode[] = [];
        for (const child of node.children) {
          leaves.push(...getLeafNodes(child));
        }
        return leaves;
      }

      const leaves = getLeafNodes(root);

      for (const leaf of leaves) {
        let current: InternalNode | null = leaf;

        while (current) {
          const parent = current.parent;
          if (!parent) break;
          if (parent.shouldPrune) {
            current = parent;
            continue;
          }

          const isKeeper = parent.isKeeper;
          const isStructural = parent.isStructural;
          let shouldMarkForPruning = false;

          if (hierarchyMode === 'minimal') {
            shouldMarkForPruning = !isStructural && !isKeeper;
          } else if (hierarchyMode === 'important') {
            const remainingChildrenCount = parent.children.filter(
              child => !child.shouldPrune
            ).length;
            const parentRemainingChildrenCount = parent.parent
              ? parent.parent.children.filter(child => !child.shouldPrune)
                  .length
              : 0;
            shouldMarkForPruning =
              !isStructural &&
              !isKeeper &&
              (remainingChildrenCount === 1 ||
                parentRemainingChildrenCount === 1);
          }

          if (shouldMarkForPruning) {
            parent.shouldPrune = true;
          }

          current = parent;
        }
      }
    }

    function convertToSemanticTree(node: InternalNode | null): SemanticNode[] {
      if (!node) return [];

      if (node.shouldPrune) {
        const result: SemanticNode[] = [];
        for (const child of node.children) {
          result.push(...convertToSemanticTree(child));
        }
        return result;
      }

      const semanticNode = buildSemanticNode(node);
      if (!semanticNode) return [];

      semanticNode.children = [];
      for (const child of node.children) {
        semanticNode.children.push(...convertToSemanticTree(child));
      }

      return [semanticNode];
    }

    // Main execution
    const elementsToInclude = getFilteredElements(options);
    const internalRoot = buildInternalTree(elementsToInclude);
    markNodesForPruning(internalRoot, options.hierarchy || 'important');
    const semanticNodes = convertToSemanticTree(internalRoot);

    return semanticNodes.length > 0
      ? semanticNodes[0] || EMPTY_NODE
      : EMPTY_NODE;
  }, options);
}

// Serialize semantic node to string
export function serializeSemanticNode(
  node: SemanticNode | null,
  options: SemanticTreeSerializeOptions = {}
): string {
  const {
    maxLength = 30000,
    maxNodeTextLength = 1000,
    skipHierarchyNodeContent = true,
    skipNonVisibleElements = true,
    skipNonScrollableIntoView = false,
    includeUuid = 'interactive' as 'interactive' | 'all' | 'none',
    includeRole = false,
    includeAttributes = true,
    includeDeductedName = true,
    includeAdditionalInfo = true,
    includePath = false,
    includeInteractive = false,
    includeVisibility = false,
  } = options;

  if (!node) return 'EMPTY!';

  const processChildren = (children: SemanticNode[], depth: number): string => {
    let result = '';
    for (const child of children) {
      const childText = processNode(child, depth);
      if (childText) result += childText;
    }
    return result;
  };

  const processNode = (currentNode: SemanticNode, depth: number): string => {
    let result = '';
    const indent = '\t'.repeat(depth);

    if (skipNonVisibleElements && currentNode.visible === false) {
      if (currentNode.children && currentNode.children.length > 0) {
        return processChildren(currentNode.children, depth);
      }
      return '';
    }

    if (skipNonScrollableIntoView && currentNode.scrollableIntoView === false) {
      if (currentNode.children && currentNode.children.length > 0) {
        return processChildren(currentNode.children, depth);
      }
      return '';
    }

    result += indent;
    if (
      ((includeUuid === 'interactive' &&
        currentNode.interactive &&
        !currentNode.isHierarchyNode) ||
        (includeUuid === 'all' && includeUuid !== 'none')) &&
      currentNode.id
    ) {
      result += `[${currentNode.id}]`;
    }
    result += `<${currentNode.tagName}`;

    if (includeRole && currentNode.role) {
      result += ` aria-role="${currentNode.role}"`;
    }
    if (includeDeductedName && currentNode.deductedName) {
      result += ` aria-name="${currentNode.deductedName}"`;
    }
    if (includeAttributes && currentNode.attributes) {
      const attrs = currentNode.attributes.split('; ');
      attrs.forEach(attr => {
        const [key, value] = attr.split('=');
        if (key && value) {
          result += ` ${key}="${value}"`;
        }
      });
    }
    if (includePath && currentNode.path) {
      result += ` path="${currentNode.path}"`;
    }
    if (includeVisibility && currentNode.visible !== undefined) {
      result += ` visible="${currentNode.visible}"`;
    }
    if (includeInteractive && currentNode.interactive) {
      result += ` interactive="${currentNode.interactive}"`;
    }
    if (currentNode.boundingBox) {
      result += ` pos="${currentNode.boundingBox.x},${currentNode.boundingBox.y},${currentNode.boundingBox.width},${currentNode.boundingBox.height}"`;
    }
    result += '>';

    let hasContent = false;
    if (
      currentNode.value &&
      currentNode.value.trim() &&
      (!skipHierarchyNodeContent || !currentNode.isHierarchyNode)
    ) {
      let nodeText = currentNode.value.trim();
      if (nodeText.length > maxNodeTextLength) {
        nodeText = nodeText.slice(0, maxNodeTextLength) + '...';
      }
      result += nodeText;
      hasContent = true;
    }

    if (includeAdditionalInfo && currentNode.additionalInfo) {
      if (hasContent) result += ' ';
      result += `(${currentNode.additionalInfo})`;
      hasContent = true;
    }

    if (currentNode.children.length > 0) {
      result += '\n';
      result += processChildren(currentNode.children, depth + 1);
      result += indent + `</${currentNode.tagName}>\n`;
    } else if (hasContent) {
      result += `</${currentNode.tagName}>\n`;
    } else {
      result = result.slice(0, -1) + '/>\n';
    }

    return result;
  };

  let result = processNode(node, 0).trim();

  if (result.length > maxLength) {
    result = result.slice(0, maxLength) + '\n... (truncated)';
  }

  return result;
}
