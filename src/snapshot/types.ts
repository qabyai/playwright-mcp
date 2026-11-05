// Semantic DOM Node structure
export interface SemanticNode {
  id?: string; // UUID if present
  tagName: string; // HTML tag name
  value?: string; // Direct text content
  additionalInfo?: string; // Processed content (e.g., for select options)
  nestedText?: string; // Nested text content
  attributes?: string; // Detailed attributes string
  role?: string; // ARIA role
  deductedName?: string; // Name from aria-label, title, alt, etc.
  path?: string; // Full DOM path
  selector?: string; // CSS selector for this element
  children: SemanticNode[]; // Child nodes
  visible?: boolean; // Computed visibility
  interactive?: boolean; // Whether element is interactive
  scrollableIntoView?: boolean; // Whether element is scrollable into view
  isHierarchyNode?: boolean; // Whether element is a hierarchy node
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Options for building Semantic Tree
export interface SemanticTreeOptions {
  filterByUuids?: string[];
  excludeNonVisible?: boolean;
  excludeNonScrollableIntoView?: boolean;
  excludeNonTopElements?: boolean;
  excludeEmptyTextElements?: boolean;
  excludeNonInteractive?: boolean;
  elementTypes?: Array<'TextInput' | 'FileInput'>;
  includeDisabledElements?: boolean;
  includeAttributes?: boolean;
  includePath?: boolean;
  hierarchy?: 'full' | 'important' | 'minimal';
}

// Options for serializing Semantic Node
export interface SemanticTreeSerializeOptions {
  mode?: 'html' | 'md';
  maxLength?: number;
  maxNodeTextLength?: number;
  skipHierarchyNodeContent?: boolean;
  skipNonVisibleElements?: boolean;
  skipNonScrollableIntoView?: boolean;
  includeUuid?: 'all' | 'interactive' | 'none';
  includeAttributes?: boolean;
  includeRole?: boolean;
  includeDeductedName?: boolean;
  includePath?: boolean;
  includeAdditionalInfo?: boolean;
  includeInteractive?: boolean;
  includeVisibility?: boolean;
}

// Element bounds for bounding box drawing
export interface ElementBounds {
  top: number;
  left: number;
  width: number;
  height: number;
  uuid: string;
  isGroup: boolean;
  color: string;
  label: string;
}

// Element group for dense UI areas
export interface ElementGroup {
  id: string;
  type: 'group';
  label: string;
  elements: string[];
  bounds: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

// Result of grouping interactive elements
export interface GroupingResult {
  groups: ElementGroup[];
  ungroupedElements: string[];
}

// Bounding box result with screenshot
export interface BoundingBoxResult {
  screenshot: Buffer;
  groups?: ElementGroup[];
  labelMapping?: string; // Descriptive text mapping labels to element IDs
  dimensions?: {
    screenshot: { width: number; height: number };
    viewport: { width: number; height: number };
  };
}

// Snapshot result
export interface SnapshotResult {
  url: string;
  title: string;
  semanticTree: string;
  screenshot: string; // base64
  labelMapping: string; // Descriptive text mapping labels to element IDs
}

// Declare window augmentation for browser-side helpers
declare global {
  interface Window {
    __snapshot?: {
      visibility: {
        isElementVisible: (element: Element) => boolean;
        isElementInViewport: (element: Element) => boolean;
        isElementInExpandedViewport: (element: Element) => boolean;
        isScrollableIntoView: (element: Element) => boolean;
        isTopElement: (element: Element) => boolean;
      };
      interactive: {
        isInteractiveElement: (
          element: Element,
          config?: {
            includeDisabledElements?: boolean;
            elementTypes?: Array<'TextInput' | 'FileInput'>;
          }
        ) => boolean;
      };
      generateUUID: () => string;
      uuidMap: Map<string, Element>;
      selectorsMap?: Map<string, string>; // Map of UUID to CSS selector
      cache?: {
        getCachedComputedStyle: (element: Element) => CSSStyleDeclaration;
      };
    };
  }
}

export {};
