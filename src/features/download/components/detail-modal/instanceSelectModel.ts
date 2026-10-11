export interface CompatibleInstance {
  id: string;
  name: string;
  version?: string;
  loader?: string;
}

export interface MissingDependency {
  id: string;
  name: string;
}

export const AUTO_DEPS_FOCUS_KEY = 'modal-inst-auto-deps';
export const CANCEL_BUTTON_FOCUS_KEY = 'modal-inst-cancel';
export const CONFIRM_BUTTON_FOCUS_KEY = 'modal-inst-confirm';
export const getInstanceFocusKey = (id: string) => `modal-inst-item-${id}`;
