import { BrowserEvent, BrowserEventType } from './events.js';
import { getSelectors } from './selector-engine.js';
import { Window } from 'happy-dom';

const parseDom = (html: string) => {
  const window = new Window({
    settings: {
      disableJavaScriptEvaluation: true,
    },
  });
  window.document.write(html);
  return window.document as unknown as Document;
};

export const preprocessBrowserEvent = (event: BrowserEvent) => {
  if (
    event.type === BrowserEventType.Click ||
    event.type === BrowserEventType.Input
  ) {
    const dom = parseDom(event.dom);
    event.selectors = getSelectors(dom, event.elementUUID);

    const element = dom.querySelector(`[uuid="${event.elementUUID}"]`);
    event.elementName = element ? getElementName(element) : 'unknown';
    event.elementType = element ? getElementType(element) : 'unknown';
    // for efficiency, we don't need to preserve it for now
    event.dom = '';
  }
};

const extractText = (element: Element): string => {
  if (element.childNodes.length === 0) {
    return element.textContent?.trim() || '';
  }

  const texts = Array.from(element.childNodes).map(node =>
    extractText(node as unknown as Element)
  );
  return texts
    .filter(text => text.trim().length > 0)
    .map(text => text.trim())
    .join('\n');
};

const extractTextsFromSiblings = (element: Element): string[] => {
  const siblings = Array.from(element.parentElement?.childNodes || []);
  return siblings
    .map(sibling => extractText(sibling as unknown as Element))
    .map(text => text.trim())
    .filter(text => text.length > 0);
};

const getElementName = (element: Element) => {
  let text = '';
  const priorityAttrs = ['aria-label', 'title', 'placeholder', 'name', 'alt'];
  for (const attr of priorityAttrs) {
    if (!text) {
      text = element?.getAttribute(attr) || '';
    }
  }
  if (!text) {
    text = extractText(element);
  }
  if (!text) {
    text = extractTextsFromSiblings(element).join('\n');
  }
  if (!text) {
    text = 'unknown';
  }
  return text;
};

const getElementType = (element: Element) => {
  const tagName = element?.tagName.toLowerCase();
  let elementType: 'button' | 'link' | 'input' | 'textarea' | 'element' =
    'element';
  if (tagName === 'a') {
    elementType = 'link';
  } else if (tagName === 'button') {
    elementType = 'button';
  } else if (tagName === 'textarea') {
    elementType = 'textarea';
  } else if (tagName === 'input') {
    elementType = 'input';
  }
  return elementType;
};
