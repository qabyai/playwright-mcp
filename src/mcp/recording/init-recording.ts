import {
  type BaseBrowserEvent,
  BrowserEventType,
  type ClickBrowserEvent,
  type InputBrowserEvent,
  type KeyPressBrowserEvent,
  type OpenPageBrowserEvent,
} from './events';
import type { Page } from 'playwright';
import { getSnowflakeId } from './snowflake';

export const initRecording = async (
  page: Page,
  onBrowserEvent: (event: BaseBrowserEvent) => void
) => {
  page.addInitScript(() => {
    if (window.self !== window.top) {
      return;
    }

    function getDom(): string {
      const snapshot = document.documentElement.cloneNode(true) as HTMLElement;

      // Handle all elements that need state preservation
      const originalElements = document.querySelectorAll<HTMLElement>('*');
      const clonedElements = snapshot.querySelectorAll<HTMLElement>('*');

      // Restore scroll positions in the clone
      originalElements.forEach((originalElement, index) => {
        const clonedElement = clonedElements[index];
        if (!clonedElement) return;

        // Preserve scroll positions as data attributes
        if (originalElement.scrollLeft || originalElement.scrollTop) {
          if (originalElement.scrollLeft) {
            clonedElement.setAttribute(
              'qaby-data-scroll-left',
              originalElement.scrollLeft.toString()
            );
          }
          if (originalElement.scrollTop) {
            clonedElement.setAttribute(
              'qaby-data-scroll-top',
              originalElement.scrollTop.toString()
            );
          }
        }

        // Handle form elements
        if (
          originalElement instanceof HTMLInputElement ||
          originalElement instanceof HTMLTextAreaElement ||
          originalElement instanceof HTMLSelectElement ||
          originalElement.hasAttribute('contenteditable')
        ) {
          preserveElementState(originalElement, clonedElement);
        }
      });

      return snapshot.outerHTML;
    }

    function preserveElementState(
      original: HTMLElement,
      cloned: HTMLElement
    ): void {
      // Handle contenteditable elements
      if (original.hasAttribute('contenteditable')) {
        // Use innerHTML instead of textContent to preserve formatting
        // Escape HTML content before storing as attribute
        const escapedHTML = original.innerHTML
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        cloned.setAttribute('qaby-data-contenteditable', escapedHTML);
      }

      // Handle form elements
      if (original instanceof HTMLInputElement) {
        preserveInputState(original, cloned as HTMLInputElement);
      } else if (original instanceof HTMLTextAreaElement) {
        preserveTextAreaState(original, cloned as HTMLTextAreaElement);
      } else if (original instanceof HTMLSelectElement) {
        preserveSelectState(original, cloned as HTMLSelectElement);
      }
    }

    function preserveInputState(
      original: HTMLInputElement,
      cloned: HTMLInputElement
    ): void {
      switch (original.type) {
        case 'checkbox':
        case 'radio':
          if (original.checked) {
            cloned.setAttribute('checked', '');
          } else {
            cloned.removeAttribute('checked');
          }
          if (original.indeterminate) {
            cloned.setAttribute('qaby-data-indeterminate', 'true');
          }
          break;
        case 'range':
          cloned.setAttribute('value', original.value);
          break;
        case 'date':
        case 'datetime-local':
        case 'month':
        case 'time':
        case 'week':
          if (original.valueAsDate) {
            cloned.setAttribute(
              'qaby-data-value-as-date',
              original.valueAsDate.toISOString()
            );
            cloned.setAttribute('value', original.value);
          }
          break;
        default:
          // For text, email, password, etc.
          cloned.setAttribute('value', original.value);
      }
    }

    function preserveTextAreaState(
      original: HTMLTextAreaElement,
      cloned: HTMLTextAreaElement
    ): void {
      cloned.innerHTML = original.value;
    }

    function preserveSelectState(
      original: HTMLSelectElement,
      cloned: HTMLSelectElement
    ): void {
      // First remove any existing selected attributes
      cloned.querySelectorAll('option').forEach(option => {
        option.removeAttribute('selected');
      });

      if (original.multiple) {
        // For multi-select, preserve selected state of each option
        Array.from(original.selectedOptions).forEach(option => {
          // Find the corresponding option in cloned select by index
          const optionIndex = Array.from(original.options).indexOf(option);
          // Use querySelector instead of options property
          const clonedOption = cloned.querySelector(
            `option:nth-child(${optionIndex + 1})`
          );
          if (clonedOption) {
            clonedOption.setAttribute('selected', '');
          }
        });
      } else if (original.selectedIndex >= 0) {
        const clonedOption = cloned.querySelector(
          `option:nth-child(${original.selectedIndex + 1})`
        );
        if (clonedOption) {
          clonedOption.setAttribute('selected', '');
        }
      }
    }

    function generateUUID(): string {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    function addAttributesToNode(node: Node): void {
      if (node.nodeType === window.Node.ELEMENT_NODE) {
        const element = node as unknown as Element;
        if (!element.getAttribute('uuid')) {
          element.setAttribute('uuid', generateUUID());
        }
        for (const child of node.childNodes) {
          addAttributesToNode(child);
        }
      }
    }

    function removeAttributesFromNode(node: Node): void {
      if (node.nodeType === window.Node.ELEMENT_NODE) {
        const element = node as unknown as Element;
        element.removeAttribute('uuid');
      }
    }

    // Event handlers
    const recordedEvents = new WeakMap<MouseEvent, boolean>();

    function handleClick(e: MouseEvent): void {
      // Check if event was already recorded
      if (recordedEvents.get(e)) {
        return;
      }

      const target = e.target as Element;
      if (!target) return;
      if (target.getAttribute('data-skip-recording')) return;

      e.stopPropagation();
      recordedEvents.set(e, true);

      addAttributesToNode(document.documentElement);
      const elementUUID = target.getAttribute('uuid');
      const dom = getDom();

      window.recordDOM(dom, elementUUID as string).then(() => {
        // Re-dispatch the event after recording
        target.dispatchEvent(e);
      });
      removeAttributesFromNode(document.documentElement);
    }

    function handleKeyDown(event: KeyboardEvent): void {
      const dom = getDom();

      if (['Enter', 'Escape'].includes(event.key)) {
        window.recordKeyPress(dom, [event.key]);
        return;
      }

      if (document.activeElement?.tagName.toLowerCase() === 'input') {
        if (event.key === 'Tab') {
          window.recordKeyPress(dom, [event.key]);
        }
        return;
      }

      if (document.activeElement?.tagName.toLowerCase() === 'textarea') {
        return;
      }

      const keys: string[] = [];
      if (event.ctrlKey) keys.push('Control');
      if (event.shiftKey) keys.push('Shift');
      if (event.altKey) keys.push('Alt');
      if (event.metaKey) keys.push('Meta');

      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
        keys.push(event.key);
      }

      if (keys.includes('Meta') && keys.includes('Tab')) {
        return;
      }

      if (keys.length === 1 && keys[0] === 'Meta') {
        return;
      }

      if (keys.length > 0) {
        window.recordKeyPress(dom, keys);
      }
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (['Enter', 'Escape'].includes(event.key)) {
        return;
      }

      if (
        document.activeElement?.tagName.toLowerCase() !== 'input' &&
        document.activeElement?.tagName.toLowerCase() !== 'textarea'
      ) {
        return;
      }

      const dom = getDom();
      window.recordInput(
        dom,
        document.activeElement.getAttribute('uuid') as string,
        (document.activeElement as HTMLInputElement).value
      );
    }

    window.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });

    console.log('Recording initialized for window:', window.location.href);
  });

  let buttonClicked = false;
  await page.exposeFunction(
    'recordDOM',
    async (dom: string, elementUUID: string) => {
      buttonClicked = true;
      const event: ClickBrowserEvent = {
        eventId: await getSnowflakeId(),
        type: BrowserEventType.Click,
        dom,
        elementUUID,
        selectors: [`[uuid="${elementUUID}"]`],
        windowUrl: page.url(),
      };
      onBrowserEvent(event);
    }
  );

  await page.exposeFunction(
    'recordInput',
    async (dom: string, elementUUID: string, value: string) => {
      const event: InputBrowserEvent = {
        eventId: await getSnowflakeId(),
        type: BrowserEventType.Input,
        dom,
        elementUUID,
        typedText: value,
        selectors: [`[uuid="${elementUUID}"]`],
        windowUrl: page.url(),
      };
      onBrowserEvent(event);
    }
  );

  await page.exposeFunction(
    'recordKeyPress',
    async (dom: string, keys: string[]) => {
      const event: KeyPressBrowserEvent = {
        eventId: await getSnowflakeId(),
        type: BrowserEventType.KeyPress,
        keys,
        dom,
        windowUrl: page.url(),
      };
      onBrowserEvent(event);
    }
  );

  page.on('load', async () => {
    if (!buttonClicked) {
      const event: OpenPageBrowserEvent = {
        eventId: await getSnowflakeId(),
        type: BrowserEventType.OpenPage,
        windowUrl: page.url(),
        // TODO: Fix navigation handling
        // title: await page.title(),
        title: '',
        // TODO: Fix dom content here
        dom: '',
      };
      onBrowserEvent(event);
    }

    buttonClicked = false;
  });
};
