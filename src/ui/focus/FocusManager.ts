// src/ui/focus/FocusManager.ts
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

class FocusManager {
  // 记录结构：{ boundaryId: lastFocusedItemKey }
  private history: Map<string, string> = new Map();

  /**
   * 记录某个容器最后聚焦的元素
   */
  saveFocus(boundaryId: string, focusKey: string) {
    this.history.set(boundaryId, focusKey);
  }

  /**
   * 恢复容器的焦点，如果没记录过，可以选择回退到默认 key
   */
  restoreFocus(boundaryId: string, fallbackFocusKey?: string) {
    const key = this.history.get(boundaryId) || fallbackFocusKey;
    if (key) {
      setFocus(key);
    }
  }

  /**
   * 强制将焦点设置到指定 key
   */
  focus(focusKey: string) {
    setFocus(focusKey);
  }

  clear(boundaryId: string) {
    this.history.delete(boundaryId);
  }
}

export const focusManager = new FocusManager();