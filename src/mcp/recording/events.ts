export enum BrowserEventType {
  Click = 'click',
  Input = 'input',
  KeyPress = 'key-press',
  OpenPage = 'open-page',
}

export interface BaseBrowserEvent {
  eventId: string;
  dom: string;
  windowUrl: string;
}

export interface ClickBrowserEvent extends BaseBrowserEvent {
  type: BrowserEventType.Click;
  elementUUID: string;
  selectors: string[];
  elementName?: string;
  elementType?: string;
}

export interface InputBrowserEvent extends BaseBrowserEvent {
  type: BrowserEventType.Input;
  elementUUID: string;
  typedText: string;
  selectors: string[];
  elementName?: string;
  elementType?: string;
}

export interface KeyPressBrowserEvent extends BaseBrowserEvent {
  type: BrowserEventType.KeyPress;
  keys: string[];
}

export interface OpenPageBrowserEvent extends BaseBrowserEvent {
  type: BrowserEventType.OpenPage;
  title: string;
}

export type BrowserEvent =
  | ClickBrowserEvent
  | InputBrowserEvent
  | KeyPressBrowserEvent
  | OpenPageBrowserEvent;
