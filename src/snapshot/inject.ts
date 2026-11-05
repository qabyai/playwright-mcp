// Browser-side snapshot helpers
// This function is stringified and injected into the page

export function injectSnapshotHelpers() {
  if (window.__snapshot) return;

  // Initialize snapshot namespace
  window.__snapshot = {
    visibility: {} as any,
    interactive: {} as any,
    generateUUID: () => {
      // Use only unambiguous characters to avoid confusion
      // Excluded: 0/O, 1/l/I, q/a/g, 6/b, 5/S, 8/B, i/j
      const chars = '234789cdefhkmnprstuvwxyz';
      return 'xxxxxxxx'.replace(/x/g, () => {
        const r = Math.floor(Math.random() * chars.length);
        return chars[r] || '';
      });
    },
    uuidMap: new Map<string, Element>(),
  };

  // ============================================
  // VISIBILITY UTILITIES
  // ============================================

  const isWhitelistedForZeroDimensions = (element: Element): boolean => {
    if (element.tagName.toLowerCase() !== 'input') return false;
    return (element as HTMLInputElement).type === 'checkbox';
  };

  window.__snapshot.visibility.isElementVisible = (
    element: Element
  ): boolean => {
    // File inputs are always considered visible
    if (
      element.tagName.toLowerCase() === 'input' &&
      (element as HTMLInputElement).type === 'file'
    ) {
      return true;
    }

    const computedStyle = window.getComputedStyle(element);
    const isHidden =
      computedStyle.display === 'none' ||
      computedStyle.visibility === 'hidden' ||
      computedStyle.opacity === '0';

    // Check parent elements for display: none or opacity: 0
    let current = element.parentElement;
    let parentInvisible = false;
    while (current && !parentInvisible) {
      const parentStyle = window.getComputedStyle(current);
      if (parentStyle.display === 'none' || parentStyle.opacity === '0') {
        parentInvisible = true;
        break;
      }
      current = current.parentElement;
    }

    // Check dimensions
    let hasZeroDimensions = false;
    if (element instanceof HTMLElement) {
      hasZeroDimensions =
        element.offsetWidth === 0 || element.offsetHeight === 0;
      if (hasZeroDimensions && isWhitelistedForZeroDimensions(element)) {
        hasZeroDimensions = false;
      }
    } else if (typeof (element as any).getBBox === 'function') {
      try {
        const { width, height } = (
          element as unknown as SVGGraphicsElement
        ).getBBox();
        hasZeroDimensions = width === 0 || height === 0;
      } catch {
        hasZeroDimensions = true;
      }
    }

    // Check if element is clipped by overflow: hidden
    const rect = element.getBoundingClientRect();
    let isClipped = false;

    if (!isWhitelistedForZeroDimensions(element)) {
      let cursor: HTMLElement | null = element as HTMLElement;
      while (cursor && !isClipped) {
        const cursorStyle = window.getComputedStyle(cursor);

        if (cursorStyle.position === 'fixed') {
          break;
        } else if (cursorStyle.position === 'absolute') {
          let ancestor: HTMLElement | null = cursor;
          while (ancestor) {
            const ancestorStyle = window.getComputedStyle(ancestor);
            if (ancestorStyle.position !== 'static') {
              cursor = ancestor;
              break;
            }
            ancestor = ancestor?.parentElement;
          }
          if (!ancestor) break;
        }

        if (
          cursorStyle.overflow === 'hidden' ||
          cursorStyle.overflowX === 'hidden' ||
          cursorStyle.overflowY === 'hidden'
        ) {
          const parentRect = cursor.getBoundingClientRect();
          if (
            rect.right < parentRect.left ||
            rect.left > parentRect.right ||
            rect.bottom < parentRect.top ||
            rect.top > parentRect.bottom
          ) {
            isClipped = true;
            break;
          }
        }
        cursor = cursor.parentElement;
      }
    }

    return !isHidden && !parentInvisible && !hasZeroDimensions && !isClipped;
  };

  window.__snapshot.visibility.isElementInViewport = (
    element: Element
  ): boolean => {
    const rect = element.getBoundingClientRect();

    if (isWhitelistedForZeroDimensions(element)) {
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      );
    }

    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  window.__snapshot.visibility.isElementInExpandedViewport = (
    element: Element
  ): boolean => {
    const rects = element.getClientRects();
    if (!rects || rects.length === 0) return false;

    for (const rect of rects) {
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        !(
          rect.bottom < 0 ||
          rect.top > window.innerHeight ||
          rect.right < 0 ||
          rect.left > window.innerWidth
        )
      ) {
        return true;
      }
    }
    return false;
  };

  window.__snapshot.visibility.isScrollableIntoView = (
    element: Element
  ): boolean => {
    if (
      element.tagName.toLowerCase() === 'input' &&
      (element as HTMLInputElement).type === 'file'
    ) {
      return true;
    }

    const computedStyle = window.getComputedStyle(element);
    const isHidden =
      computedStyle.display === 'none' || computedStyle.opacity === '0';

    if (isHidden) return false;

    let current = element.parentElement;
    while (current) {
      const parentStyle = window.getComputedStyle(current);
      if (parentStyle.display === 'none' || parentStyle.opacity === '0') {
        return false;
      }
      current = current.parentElement;
    }

    return true;
  };

  window.__snapshot.visibility.isTopElement = (element: Element): boolean => {
    if (
      element.tagName.toLowerCase() === 'input' &&
      (element as HTMLInputElement).type === 'file'
    ) {
      return true;
    }

    if (isWhitelistedForZeroDimensions(element)) {
      return true;
    }

    const rects = element.getClientRects();
    if (!rects || rects.length === 0) return false;

    if (!window.__snapshot!.visibility.isElementInExpandedViewport(element)) {
      return false;
    }

    const doc = element.ownerDocument;
    if (doc !== window.document) return true;

    const shadowRoot = element.getRootNode();
    if (shadowRoot instanceof ShadowRoot) {
      const largestRect = Array.from(rects).reduce((largest, rect) =>
        rect.width * rect.height > largest.width * largest.height
          ? rect
          : largest
      );
      const centerX = largestRect.left + largestRect.width / 2;
      const centerY = largestRect.top + largestRect.height / 2;

      try {
        const topEl = shadowRoot.elementFromPoint(centerX, centerY);
        if (!topEl) return false;

        let current: Element | null = topEl;
        while (current) {
          if (current === element) return true;
          current = current.parentElement;
        }
        return false;
      } catch {
        return true;
      }
    }

    const largestRect = Array.from(rects).reduce((largest, rect) =>
      rect.width * rect.height > largest.width * largest.height ? rect : largest
    );
    const centerX = largestRect.left + largestRect.width / 2;
    const centerY = largestRect.top + largestRect.height / 2;

    try {
      const topEl = document.elementFromPoint(centerX, centerY);
      if (!topEl) return false;

      let current: Element | null = topEl;
      while (current) {
        if (current === element) return true;
        current = current.parentElement;
      }
      return false;
    } catch {
      return true;
    }
  };

  // ============================================
  // INTERACTIVE ELEMENT DETECTION
  // ============================================

  const EXCLUDED_ELEMENTS = new Set([
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
    'animate',
    'animateTransform',
    'animateMotion',
    'set',
    'switch',
    'foreignObject',
    'view',
    'desc',
    'title',
    'metadata',
    'clipPath',
    'mask',
    'style',
    'stop',
  ]);

  const INTERACTIVE_CURSORS = new Set([
    'pointer',
    'move',
    'text',
    'grab',
    'grabbing',
    'cell',
    'copy',
    'alias',
    'all-scroll',
    'col-resize',
    'context-menu',
    'crosshair',
    'e-resize',
    'ew-resize',
    'help',
    'n-resize',
    'ne-resize',
    'nesw-resize',
    'ns-resize',
    'nw-resize',
    'nwse-resize',
    'row-resize',
    's-resize',
    'se-resize',
    'sw-resize',
    'vertical-text',
    'w-resize',
    'zoom-in',
    'zoom-out',
  ]);

  const NON_INTERACTIVE_CURSORS = new Set([
    'not-allowed',
    'no-drop',
    'wait',
    'progress',
    'initial',
    'inherit',
  ]);

  const INTERACTIVE_ELEMENTS = new Set([
    'a',
    'button',
    'input',
    'select',
    'textarea',
    'details',
    'summary',
    'label',
    'option',
    'optgroup',
  ]);

  const INTERACTIVE_ROLES = new Set([
    'button',
    'menuitem',
    'menuitemradio',
    'menuitemcheckbox',
    'radio',
    'checkbox',
    'tab',
    'switch',
    'slider',
    'spinbutton',
    'combobox',
    'searchbox',
    'textbox',
    'option',
    'scrollbar',
  ]);

  const hasInteractiveCursor = (element: Element): boolean => {
    if (element.tagName.toLowerCase() === 'html') return false;
    const style = window.getComputedStyle(element);
    return INTERACTIVE_CURSORS.has(style.cursor);
  };

  const isDisabled = (element: Element): boolean => {
    if (
      element.hasAttribute('disabled') ||
      element.getAttribute('disabled') === 'true' ||
      element.getAttribute('disabled') === ''
    ) {
      return true;
    }
    if (
      element.hasAttribute('readonly') ||
      element.getAttribute('readonly') === 'true' ||
      element.getAttribute('readonly') === ''
    ) {
      return true;
    }
    if (
      element.hasAttribute('inert') ||
      element.getAttribute('inert') === 'true' ||
      element.getAttribute('inert') === ''
    ) {
      return true;
    }
    return false;
  };

  window.__snapshot.interactive.isInteractiveElement = (
    element: Element,
    config?: {
      includeDisabledElements?: boolean;
      elementTypes?: Array<'TextInput' | 'FileInput'>;
    }
  ): boolean => {
    const ELEMENT_NODE = 1;

    if (!element || element.nodeType !== ELEMENT_NODE) {
      return false;
    }

    const elementTypes = config?.elementTypes;

    // If elementTypes filter is specified, check if element matches
    if (elementTypes && elementTypes.length > 0) {
      const tagName = element.tagName.toLowerCase();
      let matchesType = false;

      const textInputTypes = new Set([
        'text',
        'password',
        'email',
        'url',
        'tel',
        'search',
        'number',
        'date',
        'datetime-local',
        'month',
        'week',
        'time',
        'color',
      ]);

      for (const type of elementTypes) {
        switch (type) {
          case 'FileInput':
            if (
              tagName === 'input' &&
              (element as HTMLInputElement).type === 'file'
            ) {
              matchesType = true;
            }
            break;
          case 'TextInput':
            if (
              (tagName === 'input' &&
                textInputTypes.has((element as HTMLInputElement).type)) ||
              tagName === 'textarea' ||
              (element as HTMLElement).isContentEditable === true
            ) {
              matchesType = true;
            }
            break;
        }
        if (matchesType) break;
      }

      if (!matchesType) return false;
    }

    if (element.getAttribute('interactive')) {
      return true;
    }

    const tagName = element.tagName.toLowerCase();

    // Exclude SVG internal elements
    if (EXCLUDED_ELEMENTS.has(tagName)) {
      return false;
    }

    // Check visibility
    if (!window.__snapshot!.visibility.isElementVisible(element)) {
      return false;
    }

    // Check if element has interactive cursor
    if (hasInteractiveCursor(element)) {
      return true;
    }

    // Check if it's an interactive HTML element
    if (INTERACTIVE_ELEMENTS.has(tagName)) {
      const style = window.getComputedStyle(element);
      if (NON_INTERACTIVE_CURSORS.has(style.cursor)) {
        return false;
      }

      const includeDisabledElements = config?.includeDisabledElements ?? false;
      if (!includeDisabledElements && isDisabled(element)) {
        return false;
      }
      return true;
    }

    // Check ARIA roles
    const role = element.getAttribute('role');
    const ariaRole = element.getAttribute('aria-role');
    if (
      INTERACTIVE_ROLES.has(role || '') ||
      INTERACTIVE_ROLES.has(ariaRole || '')
    ) {
      return true;
    }

    // Check for contenteditable elements
    if ((element as HTMLElement).isContentEditable === true) {
      return true;
    }

    // Check for common interactive class names and attributes
    if (
      element.classList &&
      (element.classList.contains('button') ||
        element.classList.contains('dropdown-item') ||
        element.classList.contains('dropdown-toggle') ||
        element.getAttribute('data-index') ||
        element.getAttribute('data-toggle') === 'dropdown' ||
        element.getAttribute('aria-haspopup') === 'true')
    ) {
      return true;
    }

    return false;
  };

  // Freeze namespaces to prevent mutation
  Object.freeze(window.__snapshot.visibility);
  Object.freeze(window.__snapshot.interactive);
}
