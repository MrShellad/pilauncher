import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, AlertTriangle, Keyboard } from 'lucide-react';

import { SettingsSection } from '../../../ui/layout/SettingsSection';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useToastStore } from '../../../shared/stores/useToastStore';

import { KeybindEditModal } from './keymap/KeybindEditModal';
import { KeybindingList } from './keymap/KeybindingList';
import { buildKeyboardLayout } from './keymap/keyboardLayout';
import { KeyboardPreview } from './keymap/KeyboardPreview';
import { KeymapProfileManager } from './keymap/KeymapProfileManager';
import { FRIENDLY_KEYS, LWJGL_KEYS, STANDARD_KEYBINDS, mapEventCodeToMcKey } from './keymap/keyMappings';
import type {
  KeyBind,
  KeyboardLocData,
  SortField,
  SortOrder,
} from './keymap/keymapTypes';

interface KeymapSectionProps {
  instanceId: string;
}

export const KeymapSection: React.FC<KeymapSectionProps> = ({ instanceId }) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const addToast = useToastStore((s) => s.addToast);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [keybindings, setKeybindings] = useState<KeyBind[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Edit State
  const [editingBind, setEditingBind] = useState<KeyBind | null>(null);

  // Selected Key Filter State
  const [selectedKeyFilter, setSelectedKeyFilter] = useState<string | null>(null);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const [keyboardLoc, setKeyboardLoc] = useState<KeyboardLocData | null>(null);
  const [locLang, setLocLang] = useState<string>('');

  useEffect(() => {
    const loadLocalization = async () => {
      try {
        const lang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';
        const data = await invoke<KeyboardLocData>('get_keyboard_localization', { lang });
        setKeyboardLoc(data);
        setLocLang(lang);
      } catch (err) {
        console.error('加载按键本地化失败:', err);
      }
    };
    void loadLocalization();
  }, [i18n.language]);

  const keycaps = useMemo(buildKeyboardLayout, []);


  const loadKeybindings = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await invoke<KeyBind[]>('get_instance_keybindings', { instanceId });
      setKeybindings(data);
    } catch (err: any) {
      if (err === 'OPTIONS_TXT_NOT_FOUND') {
        setNotFound(true);
      } else {
        console.error('获取按键配置失败:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadKeybindings();
  }, [instanceId]);

  const handleInitializeDefault = async () => {
    setLoading(true);
    try {
      await invoke('initialize_default_keybindings', { instanceId });
      addToast('success', t('instanceDetail.game.successInit', '默认按键初始化成功'), 2400);
      void loadKeybindings();
    } catch (err) {
      console.error('初始化按键配置失败:', err);
      setLoading(false);
    }
  };

  // Conflict calculation
  const conflictCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const kb of keybindings) {
      if (kb.key && kb.key !== 'key.keyboard.none' && kb.key !== '0') {
        counts[kb.key] = (counts[kb.key] || 0) + 1;
      }
    }
    return counts;
  }, [keybindings]);

  // Display name helper
  const getActionDisplayName = (actionName: string): string => {
    if (keyboardLoc && keyboardLoc.actions[actionName]) {
      return keyboardLoc.actions[actionName];
    }
    const std = STANDARD_KEYBINDS[actionName];
    if (std) {
      return isZh ? std.zh : std.en;
    }
    return actionName;
  };

  const getFriendlyKeyName = (keyVal: string): string => {
    if (!keyVal) return "-";
    if (keyboardLoc && keyboardLoc.keys[keyVal]) {
      return keyboardLoc.keys[keyVal];
    }
    if (FRIENDLY_KEYS[keyVal]) {
      return isZh ? FRIENDLY_KEYS[keyVal].zh : FRIENDLY_KEYS[keyVal].en;
    }
    if (keyVal.startsWith("key.keyboard.")) {
      const rawName = keyVal.replace("key.keyboard.", "");
      return rawName.toUpperCase();
    }
    if (LWJGL_KEYS[keyVal]) {
      return LWJGL_KEYS[keyVal];
    }
    return keyVal;
  };

  // Filtered Keybinds
  const filteredKeybindings = useMemo(() => {
    let list = keybindings;
    if (selectedKeyFilter) {
      list = list.filter((kb) => kb.key === selectedKeyFilter);
    }
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase().trim();
    return list.filter((kb) => {
      const dispName = getActionDisplayName(kb.name).toLowerCase();
      const rawName = kb.name.toLowerCase();
      const keyFriendly = getFriendlyKeyName(kb.key).toLowerCase();
      const keyRaw = kb.key.toLowerCase();
      return dispName.includes(query) || rawName.includes(query) || keyFriendly.includes(query) || keyRaw.includes(query);
    });
  }, [keybindings, searchQuery, selectedKeyFilter, isZh]);

  // Sorted Keybindings
  const sortedKeybindings = useMemo(() => {
    const list = [...filteredKeybindings];
    list.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'name') {
        valA = getActionDisplayName(a.name);
        valB = getActionDisplayName(b.name);
      } else if (sortField === 'key') {
        valA = getFriendlyKeyName(a.key);
        valB = getFriendlyKeyName(b.key);
      } else if (sortField === 'status') {
        const isConflictA = (conflictCountMap[a.key] || 0) > 1;
        const isConflictB = (conflictCountMap[b.key] || 0) > 1;
        if (isConflictA !== isConflictB) {
          return sortOrder === 'asc'
            ? (isConflictA ? -1 : 1)
            : (isConflictA ? 1 : -1);
        }
        valA = getActionDisplayName(a.name);
        valB = getActionDisplayName(b.name);
      }

      return sortOrder === 'asc'
        ? valA.localeCompare(valB, 'zh')
        : valB.localeCompare(valA, 'zh');
    });
    return list;
  }, [filteredKeybindings, sortField, sortOrder, conflictCountMap]);

  // Save specific keybind
  const saveKeybind = async (name: string, newKey: string) => {
    const updated = keybindings.map((kb) => {
      if (kb.name === name) {
        return { ...kb, key: newKey };
      }
      return kb;
    });

    try {
      await invoke('save_instance_keybindings', { instanceId, keybindings: updated });
      setKeybindings(updated);
      addToast('success', t('instanceDetail.game.successSave', '按键已保存'), 2000);
    } catch (err) {
      console.error('保存按键失败:', err);
    } finally {
    }
  };

  // Global keydown capture while editing
  useEffect(() => {
    if (!editingBind) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const mcKey = mapEventCodeToMcKey(e.code);
      void saveKeybind(editingBind.name, mcKey);
      setEditingBind(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [editingBind]);

  const bindMouse = (mouseKey: string) => {
    if (!editingBind) return;
    void saveKeybind(editingBind.name, mouseKey);
    setEditingBind(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return (
      <SettingsSection title={t('instanceDetail.game.keymapTitle', '按键布局管理')} icon={<Keyboard size="1.125rem" />}>
        <div className="flex h-[10rem] items-center justify-center text-ore-text-muted">
          <Loader2 size="1.5rem" className="animate-spin mr-[0.5rem]" />
          <span className="text-[1.0625rem]">正在加载配置文件...</span>
        </div>
      </SettingsSection>
    );
  }

  if (notFound) {
    return (
      <SettingsSection title={t('instanceDetail.game.keymapTitle', '按键布局管理')} icon={<Keyboard size="1.125rem" />}>
        <div className="mx-[1.5rem] my-[1.25rem] border-[0.125rem] border-dashed border-ore-gray-border bg-[#1E1E1F]/50 p-[1.5rem] flex flex-col items-center justify-center text-center font-minecraft rounded-[2px]">
          <AlertTriangle size="2.25rem" className="text-ore-gold mb-[0.75rem] animate-bounce" />
          <h4 className="text-[1.25rem] text-white mb-[0.25rem]">{t('instanceDetail.game.keyNotFound', '未找到配置文件')}</h4>
          <p className="text-[1.0625rem] text-ore-text-muted max-w-[28rem] mb-[1.25rem]">
            {t('instanceDetail.game.keyNotFoundDesc', '未检测到 options.txt 配置文件，可能因为该实例尚未运行过。您可以初始化一个默认按键布局。')}
          </p>
          <OreButton
            focusKey="keybind-btn-init"
            variant="primary"
            onClick={handleInitializeDefault}
          >
            {t('instanceDetail.game.initDefault', '初始化默认按键')}
          </OreButton>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title={t('instanceDetail.game.keymapTitle', '按键布局管理')} icon={<Keyboard size="1.125rem" />}>
      <div className="flex flex-col w-full font-minecraft relative px-[1.5rem] py-[1.25rem]">

        <KeyboardPreview
          keybindings={keybindings}
          keycaps={keycaps}
          keyboardLoc={keyboardLoc}
          localizationLanguage={locLang}
          selectedKey={selectedKeyFilter}
          onSelectedKeyChange={setSelectedKeyFilter}
          getActionDisplayName={getActionDisplayName}
          getFriendlyKeyName={getFriendlyKeyName}
        />

        <KeybindingList
          keybindings={sortedKeybindings}
          conflictCountMap={conflictCountMap}
          searchQuery={searchQuery}
          selectedKey={selectedKeyFilter}
          sortField={sortField}
          sortOrder={sortOrder}
          onSearchQueryChange={setSearchQuery}
          onSelectedKeyChange={setSelectedKeyFilter}
          onSortChange={toggleSort}
          onEditKeybinding={setEditingBind}
          onOpenConfiguration={() => setIsConfigModalOpen(true)}
          getActionDisplayName={getActionDisplayName}
          getFriendlyKeyName={getFriendlyKeyName}
        />

      </div>

      <KeybindEditModal
        keybinding={editingBind}
        onClose={() => setEditingBind(null)}
        onBindMouse={bindMouse}
        getActionDisplayName={getActionDisplayName}
      />

      <KeymapProfileManager
        isOpen={isConfigModalOpen}
        instanceId={instanceId}
        keybindings={keybindings}
        onClose={() => setIsConfigModalOpen(false)}
        onKeybindingsChange={setKeybindings}
        onReload={loadKeybindings}
      />
    </SettingsSection>
  );
};
