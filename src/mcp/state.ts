import type { Page } from 'playwright';
type PickingType = 'DOM' | 'Image';

let globalState = {
  messages: [] as Message[],
  pickingType: null as PickingType | null,
  recordingInteractions: false as boolean,
  code: `async function run(page) {
    let title = await page.title();
    return title
}` as string,
};

async function initState(page: Page) {
  // function to notify Node.js from React
  await page.exposeFunction('updateGlobalState', (state: any) => {
    updateState(page, state);
  });

  await page.exposeFunction('triggerSyncToReact', () => {
    updateState(page, getState());
  });

  await page.addInitScript(state => {
    if (window.globalState) {
      return;
    }

    window.globalState = state;
    window.stateSubscribers = [];

    // function to notify other components
    window.notifyStateSubscribers = () => {
      window.stateSubscribers.forEach(cb => cb(window.globalState));
    };
  }, globalState);
}

async function syncToReact(page: Page, state: typeof globalState) {
  const allFrames = await page.frames();
  const toolboxFrame = allFrames.find(f => f.name() === 'toolbox-frame');
  if (!toolboxFrame) {
    console.error('Toolbox frame not found');
    return;
  }

  try {
    await toolboxFrame.evaluate(state => {
      window.globalState = state;
      window.notifyStateSubscribers();
    }, state);
  } catch (error) {
    console.debug('Error syncing to React:', error);
  }
}

const getState = () => {
  return structuredClone(globalState);
};

const updateState = (page: Page, state: typeof globalState) => {
  globalState = structuredClone(state);
  syncToReact(page, state);
};

export { initState, getState, updateState, type Message };
