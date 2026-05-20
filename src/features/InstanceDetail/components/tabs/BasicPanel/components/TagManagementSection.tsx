import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Check,
  Pickaxe,
  Rocket,
  Sparkles,
  Sprout,
  Star,
  Tag,
  Tags,
  Swords,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';

import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../../../ui/primitives/OreDropdown';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';
import { FocusItem } from '../../../../../../ui/focus/FocusItem';
import { useLauncherStore } from '../../../../../../store/useLauncherStore';
import type { TagManagementSectionProps } from '../schemas/basicPanelSchemas';

const TAG_ICON_OPTIONS: Array<{ value: string; label: string; Icon: LucideIcon }> = [
  { value: 'tag', label: '标签', Icon: Tag },
  { value: 'star', label: '收藏', Icon: Star },
  { value: 'tool', label: '工具', Icon: Wrench },
  { value: 'sword', label: '战斗', Icon: Swords },
  { value: 'pickaxe', label: '采集', Icon: Pickaxe },
  { value: 'seedling', label: '生存', Icon: Sprout },
  { value: 'sparkles', label: '魔法', Icon: Sparkles },
  { value: 'rocket', label: '科技', Icon: Rocket },
];

const LEGACY_ICON_PREFIX_PATTERN = /^(\u{1F3F7}\uFE0F|\u2B50|\u{1F527}|\u2694\uFE0F|\u26CF\uFE0F|\u{1F331}|\u2728|\u{1F680})\s*/u;

const normalizeTagName = (value: string) =>
  value.trim().replace(LEGACY_ICON_PREFIX_PATTERN, '').replace(/\s+/g, ' ');

const normalizeTags = (tags: string[]) => {
  const unique = new Set<string>();
  tags.forEach((tag) => {
    const normalized = normalizeTagName(tag);
    if (normalized) unique.add(normalized);
  });
  return Array.from(unique);
};

const areTagsEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  return left.every((tag, index) => tag === right[index]);
};

const stripKnownIcon = (tag: string) => {
  const normalized = normalizeTagName(tag);
  return normalized.replace(LEGACY_ICON_PREFIX_PATTERN, '').trim();
};

export const TagManagementSection: React.FC<TagManagementSectionProps> = ({
  initialTags,
  isInitializing,
  onUpdateTags,
  onSuccess,
  isGlobalSaving,
  setIsGlobalSaving,
}) => {
  const instances = useLauncherStore((state) => state.instances);
  const normalizedInitialTags = useMemo(() => normalizeTags(initialTags ?? []), [initialTags]);
  const [tags, setTags] = useState<string[]>(normalizedInitialTags);
  const [fetchedAvailableTags, setFetchedAvailableTags] = useState<string[]>([]);
  const [iconValue, setIconValue] = useState(TAG_ICON_OPTIONS[0].value);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    setTags(normalizedInitialTags);
  }, [normalizedInitialTags]);

  useEffect(() => {
    let isMounted = true;

    invoke<any[]>('get_all_instances')
      .then((items) => {
        if (!isMounted) return;
        const allTags = items.flatMap((item) => (Array.isArray(item.tags) ? item.tags : []));
        setFetchedAvailableTags(normalizeTags(allTags));
      })
      .catch(() => {
        if (isMounted) setFetchedAvailableTags([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const availableTags = useMemo(() => {
    const storeTags = instances.flatMap((instance: any) =>
      Array.isArray(instance.tags) ? instance.tags : []
    );
    return normalizeTags([...storeTags, ...fetchedAvailableTags, ...normalizedInitialTags]).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [fetchedAvailableTags, instances, normalizedInitialTags]);

  const selectedIcon =
    TAG_ICON_OPTIONS.find((option) => option.value === iconValue) || TAG_ICON_OPTIONS[0];
  const SelectedIcon = selectedIcon.Icon;
  const canConfirmTag = normalizeTagName(tagInput).length > 0;

  const persistTags = async (nextTags: string[]) => {
    const normalized = normalizeTags(nextTags);
    setTags(normalized);

    if (areTagsEqual(normalized, normalizedInitialTags)) return;

    setIsGlobalSaving(true);
    try {
      await onUpdateTags(normalized);
      onSuccess('标签已保存');
    } finally {
      setIsGlobalSaving(false);
    }
  };

  const resolveInputTag = () => {
    const input = normalizeTagName(tagInput);
    if (!input) return '';

    const exactExisting = availableTags.find((tag) => tag === input);
    if (exactExisting) return exactExisting;

    const existingByName = availableTags.find((tag) => stripKnownIcon(tag) === input);
    if (existingByName) return existingByName;

    return stripKnownIcon(input);
  };

  const handleConfirmTag = async () => {
    const nextTag = resolveInputTag();
    if (!nextTag || tags.includes(nextTag)) {
      setTagInput('');
      return;
    }

    await persistTags([...tags, nextTag]);
    setTagInput('');
  };

  const handleRemoveTag = async (target: string) => {
    await persistTags(tags.filter((tag) => tag !== target));
  };

  return (
    <SettingsSection title="标签管理" icon={<Tags size="1.125rem" />}>
      <FormRow
        label="添加标签"
        description="选择图标后输入标签名，也可以在输入框中选择已有标签；确认后立即保存。"
        vertical
        control={
          <div className="w-full">
            <div className="flex w-full flex-nowrap items-center gap-2">
              <div className="w-[8.5rem] flex-shrink-0">
                <OreDropdown
                  focusKey="tag-icon-select"
                  options={TAG_ICON_OPTIONS}
                  value={iconValue}
                  onChange={setIconValue}
                  disabled={isGlobalSaving || isInitializing}
                  prefixNode={<SelectedIcon size="1rem" strokeWidth={2.5} />}
                />
              </div>
              <div className="min-w-0 flex-1">
                <OreInput
                  focusKey="tag-input-name"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleConfirmTag();
                  }}
                  disabled={isGlobalSaving || isInitializing}
                  placeholder="输入标签名称或选择已有标签"
                  containerClassName="w-full"
                  list="instance-detail-tag-options"
                />
              </div>
              <datalist id="instance-detail-tag-options">
                {availableTags
                  .filter((tag) => !tags.includes(tag))
                  .map((tag) => (
                    <option key={tag} value={stripKnownIcon(tag)} />
                  ))}
              </datalist>
              <div className="w-[6.5rem] flex-shrink-0">
                <OreButton
                  focusKey="tag-confirm-add"
                  variant="primary"
                  size="auto"
                  onClick={handleConfirmTag}
                  disabled={!canConfirmTag || isGlobalSaving || isInitializing}
                  className="w-full px-0"
                >
                  <Check size="1rem" className="mr-1.5" /> 确认
                </OreButton>
              </div>
            </div>
          </div>
        }
      />

      <FormRow
        label="当前标签"
        description="这些标签会出现在实例列表的标签筛选中。"
        vertical
        control={
          <div className="w-full">
            {tags.length === 0 ? (
              <div className="flex min-h-[5rem] flex-col items-center justify-center border-2 border-dashed border-[#1E1E1F] bg-[#141415]/50 text-ore-text-muted">
                <Tags size="1.375rem" className="mb-2 opacity-60" />
                <span className="font-minecraft text-sm">暂无标签</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <FocusItem key={tag} focusKey={`tag-remove-${index}`}>
                    {({ ref, focused }) => (
                      <button
                        ref={ref as React.RefObject<HTMLButtonElement>}
                        type="button"
                        onClick={() => void handleRemoveTag(tag)}
                        disabled={isGlobalSaving || isInitializing}
                        tabIndex={-1}
                        className={`group inline-flex h-9 items-center overflow-hidden border-2 border-[#18181B] bg-[#202226] font-minecraft text-sm text-white shadow-[inset_0_-0.125rem_0_rgba(0,0,0,0.35)] outline-none transition-all hover:border-ore-green hover:bg-[#262A28] ${focused ? 'ring-2 ring-white brightness-110' : ''
                          } disabled:opacity-50`}
                        title="移除标签"
                      >
                        <span className="flex h-full items-center gap-2 px-3">
                          <Tag size="0.875rem" strokeWidth={2.5} className="text-ore-green" />
                          <span className="text-sm leading-none">{stripKnownIcon(tag)}</span>
                        </span>
                        <span className="flex h-full w-9 items-center justify-center border-l-2 border-[#18181B] bg-black/20 text-ore-text-muted transition-colors group-hover:text-white">
                          <X size="0.875rem" />
                        </span>
                      </button>
                    )}
                  </FocusItem>
                ))}
              </div>
            )}
          </div>
        }
      />
    </SettingsSection>
  );
};
