import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { useSettingsStore } from '@/app/stores/useSettingsStore';
import type { OreProjectVersion } from '@/features/resource-catalog';
import { useInputAction } from '../../../ui/focus/InputDriver';

export type ChangelogTranslationState =
  | { status: 'loading' }
  | { status: 'translated'; text: string; source: string; target: string; chunks: number }
  | { status: 'error'; error: string };

interface ChangelogTranslationResponse {
  translatedText: string;
  source: string;
  target: string;
  chunks: number;
}

export type TranslationMode = 'translated_only' | 'bilingual';

interface UseVersionChangelogTranslationOptions {
  isOpen: boolean;
  isSponsor: boolean;
  version: OreProjectVersion | null;
}

export const useVersionChangelogTranslation = ({
  isOpen,
  isSponsor,
  version,
}: UseVersionChangelogTranslationOptions) => {
  const { tmtSecretId, tmtSecretKey } = useSettingsStore((state) => state.settings.general);
  const [translations, setTranslations] = useState<Record<string, ChangelogTranslationState>>({});
  const [showTranslatedChangelog, setShowTranslatedChangelog] = useState<Record<string, boolean>>({});
  const [translationMode, setTranslationMode] = useState<TranslationMode>('translated_only');

  useInputAction('TAB_LEFT', useCallback(() => {
    if (isOpen && version) setTranslationMode('translated_only');
  }, [isOpen, version]));
  useInputAction('PAGE_LEFT', useCallback(() => {
    if (isOpen && version) setTranslationMode('translated_only');
  }, [isOpen, version]));
  useInputAction('TAB_RIGHT', useCallback(() => {
    if (isOpen && version) setTranslationMode('bilingual');
  }, [isOpen, version]));
  useInputAction('PAGE_RIGHT', useCallback(() => {
    if (isOpen && version) setTranslationMode('bilingual');
  }, [isOpen, version]));

  const versionId = version?.id;

  const handleTranslateChangelog = useCallback(async () => {
    if (!version?.changelog?.trim() || !versionId) return;

    const current = translations[versionId];
    if (current?.status === 'translated') {
      setShowTranslatedChangelog((previous) => ({
        ...previous,
        [versionId]: !previous[versionId],
      }));
      return;
    }

    setTranslations((previous) => ({
      ...previous,
      [versionId]: { status: 'loading' },
    }));
    setShowTranslatedChangelog((previous) => ({
      ...previous,
      [versionId]: true,
    }));

    try {
      const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const htmlImageRegex = /<img[^>]*>/gi;
      const placeholders: string[] = [];
      let textToTranslate = version.changelog;

      textToTranslate = textToTranslate.replace(htmlImageRegex, (match) => {
        const placeholder = `__HTML_IMG_PL_${placeholders.length}__`;
        placeholders.push(match);
        return placeholder;
      });

      textToTranslate = textToTranslate.replace(markdownImageRegex, (match) => {
        const placeholder = `__MD_IMG_PL_${placeholders.length}__`;
        placeholders.push(match);
        return placeholder;
      });

      const result = await invoke<ChangelogTranslationResponse>('translate_changelog_tmt', {
        text: textToTranslate,
        source: 'auto',
        target: 'zh',
        secretId: tmtSecretId || null,
        secretKey: tmtSecretKey || null,
      });

      let translatedText = result.translatedText;
      placeholders.forEach((original, index) => {
        const markdownPlaceholder = new RegExp(`__MD_IMG_PL_${index}__`, 'gi');
        const htmlPlaceholder = new RegExp(`__HTML_IMG_PL_${index}__`, 'gi');
        translatedText = translatedText
          .replace(markdownPlaceholder, original)
          .replace(htmlPlaceholder, original);
      });

      setTranslations((previous) => ({
        ...previous,
        [versionId]: {
          status: 'translated',
          text: translatedText,
          source: result.source,
          target: result.target,
          chunks: result.chunks,
        },
      }));
    } catch (error) {
      setTranslations((previous) => ({
        ...previous,
        [versionId]: {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
      }));
      setShowTranslatedChangelog((previous) => ({
        ...previous,
        [versionId]: false,
      }));
    }
  }, [tmtSecretId, tmtSecretKey, translations, version, versionId]);

  const selectedTranslation = versionId ? translations[versionId] : undefined;
  const selectedHasChangelog = !!version?.changelog?.trim();
  const selectedIsShowingTranslation =
    !!versionId
    && !!showTranslatedChangelog[versionId]
    && selectedTranslation?.status === 'translated';
  const selectedChangelogText =
    isSponsor && selectedIsShowingTranslation && selectedTranslation?.status === 'translated'
      ? selectedTranslation.text
      : version?.changelog;
  const selectedCanTranslate =
    !!versionId && selectedHasChangelog && selectedTranslation?.status !== 'loading';

  return {
    handleTranslateChangelog,
    selectedCanTranslate,
    selectedChangelogText,
    selectedHasChangelog,
    selectedIsShowingTranslation,
    selectedTranslation,
    setTranslationMode,
    translationMode,
  };
};
