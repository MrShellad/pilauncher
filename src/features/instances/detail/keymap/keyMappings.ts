export const STANDARD_KEYBINDS: Record<string, { zh: string; en: string }> = {
  'key.forward': { zh: '向前移动', en: 'Move Forward' },
  'key.left': { zh: '向左移动', en: 'Move Left' },
  'key.back': { zh: '向后移动', en: 'Move Backward' },
  'key.right': { zh: '向右移动', en: 'Move Right' },
  'key.jump': { zh: '跳跃', en: 'Jump' },
  'key.sneak': { zh: '潜行', en: 'Sneak' },
  'key.sprint': { zh: '疾跑', en: 'Sprint' },
  'key.drop': { zh: '丢弃物品', en: 'Drop Item' },
  'key.inventory': { zh: '打开/关闭背包', en: 'Open/Close Inventory' },
  'key.chat': { zh: '打开聊天栏', en: 'Open Chat' },
  'key.playerlist': { zh: '显示玩家列表', en: 'List Players' },
  'key.screenshot': { zh: '截图', en: 'Take Screenshot' },
  'key.togglePerspective': { zh: '切换视角', en: 'Toggle Perspective' },
  'key.smoothCamera': { zh: '电影级摄像机', en: 'Cinematic Camera' },
  'key.swapHands': { zh: '副手物品交换', en: 'Swap Item In Hands' },
  'key.use': { zh: '使用物品/放置方块', en: 'Use Item/Place Block' },
  'key.attack': { zh: '攻击/毁坏', en: 'Attack/Destroy' },
  'key.pickItem': { zh: '选取方块', en: 'Pick Block' },
  'key.fullscreen': { zh: '切换全屏', en: 'Toggle Fullscreen' },
  'key.spectatorOutlines': { zh: '高亮显示玩家 (旁观)', en: 'Highlight Players (Spectator)' },
  'key.hotbar.1': { zh: '快捷栏第1格', en: 'Hotbar Slot 1' },
  'key.hotbar.2': { zh: '快捷栏第2格', en: 'Hotbar Slot 2' },
  'key.hotbar.3': { zh: '快捷栏第3格', en: 'Hotbar Slot 3' },
  'key.hotbar.4': { zh: '快捷栏第4格', en: 'Hotbar Slot 4' },
  'key.hotbar.5': { zh: '快捷栏第5格', en: 'Hotbar Slot 5' },
  'key.hotbar.6': { zh: '快捷栏第6格', en: 'Hotbar Slot 6' },
  'key.hotbar.7': { zh: '快捷栏第7格', en: 'Hotbar Slot 7' },
  'key.hotbar.8': { zh: '快捷栏第8格', en: 'Hotbar Slot 8' },
  'key.hotbar.9': { zh: '快捷栏第9格', en: 'Hotbar Slot 9' },
  'key.saveToolbarActivator': { zh: '保存快捷栏激活键', en: 'Save Toolbar Activator' },
  'key.loadToolbarActivator': { zh: '加载快捷栏激活键', en: 'Load Toolbar Activator' },
  'key.advancements': { zh: '打开进度界面', en: 'Advancements' },
  'key.command': { zh: '打开命令栏', en: 'Open Command' },
  'key.socialInteractions': { zh: '多人联机社交交互', en: 'Social Interactions Screen' },
};

export const FRIENDLY_KEYS: Record<string, { zh: string; en: string }> = {
  'key.mouse.left': { zh: '鼠标左键', en: 'Left Click' },
  'key.mouse.right': { zh: '鼠标右键', en: 'Right Click' },
  'key.mouse.middle': { zh: '鼠标中键', en: 'Middle Click' },
  'key.keyboard.space': { zh: '空格键', en: 'Space' },
  'key.keyboard.left.shift': { zh: '左 Shift', en: 'LShift' },
  'key.keyboard.right.shift': { zh: '右 Shift', en: 'RShift' },
  'key.keyboard.left.control': { zh: '左 Ctrl', en: 'LCtrl' },
  'key.keyboard.right.control': { zh: '右 Ctrl', en: 'RCtrl' },
  'key.keyboard.left.alt': { zh: '左 Alt', en: 'LAlt' },
  'key.keyboard.right.alt': { zh: '右 Alt', en: 'RAlt' },
  'key.keyboard.escape': { zh: 'Esc', en: 'Esc' },
  'key.keyboard.enter': { zh: '回车键', en: 'Enter' },
  'key.keyboard.tab': { zh: 'Tab 键', en: 'Tab' },
  'key.keyboard.backspace': { zh: '退格键', en: 'Backspace' },
  'key.keyboard.caps.lock': { zh: '大写锁定', en: 'Caps Lock' },
  'key.keyboard.num.lock': { zh: '数字锁定', en: 'Num Lock' },
  'key.keyboard.scroll.lock': { zh: '滚动锁定', en: 'Scroll Lock' },
  'key.keyboard.up': { zh: '方向键上', en: 'Up Arrow' },
  'key.keyboard.down': { zh: '方向键下', en: 'Down Arrow' },
  'key.keyboard.left': { zh: '方向键左', en: 'Left Arrow' },
  'key.keyboard.right': { zh: '方向键右', en: 'Right Arrow' },
};

export const LWJGL_KEYS: Record<string, string> = {
  '1': 'Esc', '2': '1', '3': '2', '4': '3', '5': '4', '6': '5', '7': '6', '8': '7', '9': '8', '10': '9', '11': '0',
  '12': '-', '13': '=', '14': 'Backspace', '15': 'Tab', '16': 'Q', '17': 'W', '18': 'E', '19': 'R', '20': 'T', '21': 'Y',
  '22': 'U', '23': 'I', '24': 'O', '25': 'P', '26': '[', '27': ']', '28': 'Enter', '29': 'LCtrl', '30': 'A', '31': 'S',
  '32': 'D', '33': 'F', '34': 'G', '35': 'H', '36': 'J', '37': 'K', '38': 'L', '39': ';', '40': "'", '41': '`',
  '42': 'LShift', '43': '\\', '44': 'Z', '45': 'X', '46': 'C', '47': 'V', '48': 'B', '49': 'N', '50': 'M', '51': ',',
  '52': '.', '53': '/', '54': 'RShift', '56': 'LAlt', '57': 'Space', '58': 'Caps Lock',
  '200': 'Up', '203': 'Left', '205': 'Right', '208': 'Down',
};

export const mapEventCodeToMcKey = (code: string): string => {
  if (code.startsWith('Key')) return `key.keyboard.${code.substring(3).toLowerCase()}`;
  if (code.startsWith('Digit')) return `key.keyboard.${code.substring(5)}`;
  if (code.startsWith('Numpad') && code.length === 7) return `key.keyboard.keypad.${code.substring(6)}`;

  const specialKeys: Record<string, string> = {
    Space: 'key.keyboard.space',
    ShiftLeft: 'key.keyboard.left.shift',
    ShiftRight: 'key.keyboard.right.shift',
    ControlLeft: 'key.keyboard.left.control',
    ControlRight: 'key.keyboard.right.control',
    AltLeft: 'key.keyboard.left.alt',
    AltRight: 'key.keyboard.right.alt',
    Escape: 'key.keyboard.escape',
    Enter: 'key.keyboard.enter',
    Tab: 'key.keyboard.tab',
    Backspace: 'key.keyboard.backspace',
    CapsLock: 'key.keyboard.caps.lock',
    ArrowUp: 'key.keyboard.up',
    ArrowDown: 'key.keyboard.down',
    ArrowLeft: 'key.keyboard.left',
    ArrowRight: 'key.keyboard.right',
  };

  if (/^F(?:[1-9]|1[0-2])$/.test(code)) return `key.keyboard.${code.toLowerCase()}`;
  return specialKeys[code] ?? `key.keyboard.${code.toLowerCase()}`;
};
