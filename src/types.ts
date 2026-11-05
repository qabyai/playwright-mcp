declare global {
  interface Message {
    type: 'DOM' | 'Image' | 'Text' | 'Interaction';
    content: string;
    windowUrl: string;
  }

  interface Window {
    // for the user page
    mcpStartPicking: (pickingType: 'DOM' | 'Image') => void;
    mcpStopPicking: () => void;
    onElementPicked: (message: Message) => void;
    // for the iframe
    triggerMcpStartPicking: (pickingType: 'DOM' | 'Image') => void;
    triggerMcpStopPicking: () => void;
    // for the react page
    globalState: any;
    stateSubscribers: ((state: any) => void)[];
    notifyStateSubscribers: () => void;
    updateGlobalState: (state: any) => void;
    triggerSyncToReact: () => void;
    // for recording
    recordDOM: (dom: string, elementUUID: string) => Promise<void>;
    recordInput: (
      dom: string,
      elementUUID: string,
      value: string
    ) => Promise<void>;
    recordKeyPress: (dom: string, keys: string[]) => Promise<void>;
  }
}
