import { updateState } from './state';
import { getState } from './state';
import { preprocessBrowserEvent } from './recording/utils';
import { Page } from 'playwright';
import _ from 'lodash';

export const handleBrowserEvent = (page: Page) => {
  const eventQueue: any[] = [];

  const processEvents = _.debounce(
    () => {
      if (eventQueue.length === 0) {
        return;
      }

      // Skip events for same element and type
      while (eventQueue.length > 1) {
        const currentEvent = eventQueue[0];
        const nextEvent = eventQueue[1];
        if (
          currentEvent.type === nextEvent.type &&
          currentEvent.elementUUID === nextEvent.elementUUID
        ) {
          eventQueue.shift();
        } else {
          break;
        }
      }

      const event = eventQueue.shift();
      const state = getState();

      preprocessBrowserEvent(event);

      if (state.messages.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage.type === 'Interaction') {
          const lastInteraction = JSON.parse(lastMessage.content);
          if (
            lastInteraction.type === 'input' &&
            lastInteraction.elementUUID === event.elementUUID
          ) {
            lastInteraction.typedText = event.typedText;
            state.messages[state.messages.length - 1] = {
              type: 'Interaction',
              content: JSON.stringify(lastInteraction),
              windowUrl: event.windowUrl,
            };
            updateState(page, state);
            return;
          }
        }
      }

      state.messages.push({
        type: 'Interaction',
        content: JSON.stringify(event),
        windowUrl: event.windowUrl,
      });
      updateState(page, state);
    },
    100,
    { maxWait: 500 }
  );

  return (event: any) => {
    const state = getState();
    if (!state.recordingInteractions || state.pickingType) {
      return;
    }

    eventQueue.push(event);
    processEvents();
  };
};
