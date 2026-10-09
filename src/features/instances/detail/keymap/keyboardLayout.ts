import keyboardLayoutJson from '@/assets/keyboard/keyboard-layout.json';
import keyboardLayoutSvg from '@/assets/keyboard/keyboard-layout.svg?raw';

import type { KeycapData } from './keymapTypes';

const INDEX_TO_MC_KEY = [
  // Row 1 (16 keys)
  "key.keyboard.escape",
  "key.keyboard.f1",
  "key.keyboard.f2",
  "key.keyboard.f3",
  "key.keyboard.f4",
  "key.keyboard.f5",
  "key.keyboard.f6",
  "key.keyboard.f7",
  "key.keyboard.f8",
  "key.keyboard.f9",
  "key.keyboard.f10",
  "key.keyboard.f11",
  "key.keyboard.f12",
  "key.keyboard.print.screen",
  "key.keyboard.scroll.lock",
  "key.keyboard.pause",

  // Row 2 (21 keys)
  "key.keyboard.grave.accent",
  "key.keyboard.1",
  "key.keyboard.2",
  "key.keyboard.3",
  "key.keyboard.4",
  "key.keyboard.5",
  "key.keyboard.6",
  "key.keyboard.7",
  "key.keyboard.8",
  "key.keyboard.9",
  "key.keyboard.0",
  "key.keyboard.minus",
  "key.keyboard.equal",
  "key.keyboard.backspace",
  "key.keyboard.insert",
  "key.keyboard.home",
  "key.keyboard.page.up",
  "key.keyboard.num.lock",
  "key.keyboard.keypad.divide",
  "key.keyboard.keypad.multiply",
  "key.keyboard.keypad.subtract",

  // Row 3 (21 keys)
  "key.keyboard.tab",
  "key.keyboard.q",
  "key.keyboard.w",
  "key.keyboard.e",
  "key.keyboard.r",
  "key.keyboard.t",
  "key.keyboard.y",
  "key.keyboard.u",
  "key.keyboard.i",
  "key.keyboard.o",
  "key.keyboard.p",
  "key.keyboard.left.bracket",
  "key.keyboard.right.bracket",
  "key.keyboard.backslash",
  "key.keyboard.delete",
  "key.keyboard.end",
  "key.keyboard.page.down",
  "key.keyboard.keypad.7",
  "key.keyboard.keypad.8",
  "key.keyboard.keypad.9",
  "key.keyboard.keypad.add",

  // Row 4 (16 keys)
  "key.keyboard.caps.lock",
  "key.keyboard.a",
  "key.keyboard.s",
  "key.keyboard.d",
  "key.keyboard.f",
  "key.keyboard.g",
  "key.keyboard.h",
  "key.keyboard.j",
  "key.keyboard.k",
  "key.keyboard.l",
  "key.keyboard.semicolon",
  "key.keyboard.apostrophe",
  "key.keyboard.enter",
  "key.keyboard.keypad.4",
  "key.keyboard.keypad.5",
  "key.keyboard.keypad.6",

  // Row 5 (17 keys)
  "key.keyboard.left.shift",
  "key.keyboard.z",
  "key.keyboard.x",
  "key.keyboard.c",
  "key.keyboard.v",
  "key.keyboard.b",
  "key.keyboard.n",
  "key.keyboard.m",
  "key.keyboard.comma",
  "key.keyboard.period",
  "key.keyboard.slash",
  "key.keyboard.right.shift",
  "key.keyboard.up",
  "key.keyboard.keypad.1",
  "key.keyboard.keypad.2",
  "key.keyboard.keypad.3",
  "key.keyboard.keypad.enter",

  // Row 6 (13 keys)
  "key.keyboard.left.control",
  "key.keyboard.left.win",
  "key.keyboard.left.alt",
  "key.keyboard.space",
  "key.keyboard.right.alt",
  "key.keyboard.right.win",
  "key.keyboard.menu",
  "key.keyboard.right.control",
  "key.keyboard.left",
  "key.keyboard.down",
  "key.keyboard.right",
  "key.keyboard.keypad.0",
  "key.keyboard.keypad.decimal"
];

export const buildKeyboardLayout = (): KeycapData[] => {
  try {
    const parser = new DOMParser();
    const document = parser.parseFromString(keyboardLayoutSvg, 'image/svg+xml');
    const keycapGroups = document.querySelectorAll('.keycap');
    const labels = (keyboardLayoutJson as unknown[][])
      .flatMap((row) => row)
      .filter((item): item is string => typeof item === 'string');

    return Array.from(keycapGroups).map((group, index) => {
      const rectangles = Array.from(group.querySelectorAll('rect'));
      const outerRectangle = rectangles[1] || rectangles[0];
      const innerRectangle = rectangles[3] || rectangles[2] || rectangles[0];
      return {
        index,
        outer: {
          x: Number.parseFloat(outerRectangle?.getAttribute('x') || '0'),
          y: Number.parseFloat(outerRectangle?.getAttribute('y') || '0'),
          w: Number.parseFloat(outerRectangle?.getAttribute('width') || '0'),
          h: Number.parseFloat(outerRectangle?.getAttribute('height') || '0'),
          rx: Number.parseFloat(outerRectangle?.getAttribute('rx') || '0'),
        },
        inner: {
          x: Number.parseFloat(innerRectangle?.getAttribute('x') || '0'),
          y: Number.parseFloat(innerRectangle?.getAttribute('y') || '0'),
          w: Number.parseFloat(innerRectangle?.getAttribute('width') || '0'),
          h: Number.parseFloat(innerRectangle?.getAttribute('height') || '0'),
          rx: Number.parseFloat(innerRectangle?.getAttribute('rx') || '0'),
        },
        label: labels[index] || '',
        keyCode: INDEX_TO_MC_KEY[index] || `key.keyboard.unknown_${index}`,
      };
    });
  } catch (error) {
    console.error('Error parsing keyboard layout:', error);
    return [];
  }
};
