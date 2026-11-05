import type { Page } from 'playwright';
import type { ElementBounds } from './types';

/**
 * Add DOM-based annotations to elements on the page
 * This replaces the need for skia-canvas by drawing directly in the browser
 */
export async function addDOMAnnotations(
  page: Page,
  bounds: ElementBounds[]
): Promise<void> {
  await page.evaluate((bounds: ElementBounds[]) => {
    // Remove any existing annotations first
    const existingAnnotations = document.querySelectorAll(
      '[data-pw-annotation]'
    );
    existingAnnotations.forEach(el => el.remove());

    // Create a container for all annotations
    const annotationLayer = document.createElement('div');
    annotationLayer.setAttribute('data-pw-annotation', 'layer');
    annotationLayer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483647;
    `;
    document.body.appendChild(annotationLayer);

    // Helper function to create label position based on element bounds
    const calculateLabelPosition = (bound: ElementBounds) => {
      const elementArea = bound.width * bound.height;
      const isSmallElement = elementArea < 2000;
      const bubbleWidth = isSmallElement ? 16 : 28;
      const bubbleHeight = isSmallElement ? 16 : 24;

      // Try different positions to avoid overlaps
      const positions = [
        { x: bound.left - bubbleWidth - 5, y: bound.top }, // Left
        { x: bound.left + bound.width + 5, y: bound.top }, // Right
        { x: bound.left, y: bound.top - bubbleHeight - 5 }, // Top
        { x: bound.left, y: bound.top + bound.height + 5 }, // Bottom
        { x: bound.left - bubbleWidth - 5, y: bound.top - bubbleHeight - 5 }, // Top-left
        { x: bound.left + bound.width + 5, y: bound.top - bubbleHeight - 5 }, // Top-right
      ];

      // Find the first position that fits in viewport
      for (const pos of positions) {
        if (
          pos.x >= 0 &&
          pos.y >= 0 &&
          pos.x + bubbleWidth <= window.innerWidth &&
          pos.y + bubbleHeight <= window.innerHeight
        ) {
          return { ...pos, width: bubbleWidth, height: bubbleHeight };
        }
      }

      // Fallback to top-left corner of element
      return {
        x: Math.max(
          5,
          Math.min(bound.left, window.innerWidth - bubbleWidth - 5)
        ),
        y: Math.max(
          5,
          Math.min(
            bound.top - bubbleHeight - 5,
            window.innerHeight - bubbleHeight - 5
          )
        ),
        width: bubbleWidth,
        height: bubbleHeight,
      };
    };

    // Draw each bounding box and label
    bounds.forEach(bound => {
      // Create bounding box
      const box = document.createElement('div');
      box.setAttribute('data-pw-annotation', 'box');
      box.style.cssText = `
        position: absolute;
        left: ${bound.left}px;
        top: ${bound.top}px;
        width: ${bound.width}px;
        height: ${bound.height}px;
        border: ${bound.isGroup ? '3px dashed' : '2px solid'} ${bound.color};
        background-color: ${bound.color}${bound.isGroup ? '10' : '15'};
        pointer-events: none;
        box-sizing: border-box;
      `;
      annotationLayer.appendChild(box);

      // Create label if it has one
      if (bound.label) {
        const labelPos = calculateLabelPosition(bound);
        const label = document.createElement('div');
        label.setAttribute('data-pw-annotation', 'label');

        const isSmallLabel = labelPos.width < 20;
        const fontSize = labelPos.height <= 16 ? 9 : 12;

        label.style.cssText = `
          position: absolute;
          left: ${labelPos.x}px;
          top: ${labelPos.y}px;
          width: ${labelPos.width}px;
          height: ${labelPos.height}px;
          background-color: ${bound.color};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: ${isSmallLabel ? '3px' : '4px'};
          font-family: system-ui, -apple-system, sans-serif;
          font-size: ${fontSize}px;
          font-weight: bold;
          box-shadow: 0 ${isSmallLabel ? '2px 4px' : '2px 8px'} rgba(0, 0, 0, 0.3);
          pointer-events: none;
          opacity: ${isSmallLabel ? 0.85 : 1.0};
        `;
        label.textContent = bound.label;
        annotationLayer.appendChild(label);
      }
    });
  }, bounds);
}

/**
 * Remove all DOM annotations from the page
 */
export async function removeDOMAnnotations(page: Page): Promise<void> {
  await page.evaluate(() => {
    const existingAnnotations = document.querySelectorAll(
      '[data-pw-annotation]'
    );
    existingAnnotations.forEach(el => el.remove());
  });
}

/**
 * Take a screenshot with DOM annotations
 * This is the main replacement for the skia-canvas approach
 */
export async function screenshotWithDOMAnnotations(
  page: Page,
  bounds: ElementBounds[],
  fullPage: boolean = false
): Promise<Buffer> {
  try {
    // Add annotations to the page
    await addDOMAnnotations(page, bounds);

    // Give the browser a moment to render the annotations
    await page.waitForTimeout(100);

    // Take screenshot with annotations visible
    const screenshot = await page.screenshot({
      fullPage: fullPage,
    });

    // Remove annotations after screenshot
    await removeDOMAnnotations(page);

    return screenshot;
  } catch (error) {
    // Clean up annotations in case of error
    await removeDOMAnnotations(page);
    throw error;
  }
}
