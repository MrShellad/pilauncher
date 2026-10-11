import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '@/app/stores/useSettingsStore';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { useIsSponsor } from '../../../hooks/useIsSponsor';

export type TranslationState =
  | { status: 'loading' }
  | { status: 'translated'; text: string; source: string; target: string }
  | { status: 'error'; error: string };

interface TranslationResponse {
  translatedText: string;
  source: string;
  target: string;
}

export type TranslationMode = 'translated_only' | 'bilingual';

interface UseProjectDescriptionTranslationOptions {
  isOpen: boolean;
  projectId: string;
  rawDescription: string;
}

export const useProjectDescriptionTranslation = ({
  isOpen,
  projectId,
  rawDescription,
}: UseProjectDescriptionTranslationOptions) => {
  const isSponsor = useIsSponsor();
  const { tmtSecretId, tmtSecretKey } = useSettingsStore((state) => state.settings.general);
  const [translation, setTranslation] = useState<TranslationState | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationMode, setTranslationMode] = useState<TranslationMode>('translated_only');

  useInputAction('TAB_LEFT', useCallback(() => {
    if (isOpen) setTranslationMode('translated_only');
  }, [isOpen]));
  useInputAction('PAGE_LEFT', useCallback(() => {
    if (isOpen) setTranslationMode('translated_only');
  }, [isOpen]));
  useInputAction('TAB_RIGHT', useCallback(() => {
    if (isOpen) setTranslationMode('bilingual');
  }, [isOpen]));
  useInputAction('PAGE_RIGHT', useCallback(() => {
    if (isOpen) setTranslationMode('bilingual');
  }, [isOpen]));

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTranslation(null);
      setShowTranslation(false);
    }
  }, [isOpen, projectId]);

  const handleTranslateDescription = useCallback(async () => {
    if (!rawDescription.trim()) return;

    if (translation?.status === 'translated') {
      setShowTranslation((previous) => !previous);
      return;
    }

    setTranslation({ status: 'loading' });
    setShowTranslation(true);

    try {
      const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const htmlImageRegex = /<img[^>]*>/gi;
      const iframeRegex = /<iframe[\s\S]*?<\/iframe>/gi;
      const placeholders: string[] = [];
      let textToTranslate = rawDescription;

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

      textToTranslate = textToTranslate.replace(iframeRegex, (match) => {
        const placeholder = `__IFRAME_PL_${placeholders.length}__`;
        placeholders.push(match);
        return placeholder;
      });

      const result = await invoke<TranslationResponse>('translate_changelog_tmt', {
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
        const iframePlaceholder = new RegExp(`__IFRAME_PL_${index}__`, 'gi');
        translatedText = translatedText
          .replace(markdownPlaceholder, original)
          .replace(htmlPlaceholder, original)
          .replace(iframePlaceholder, original);
      });

      setTranslation({
        status: 'translated',
        text: translatedText,
        source: result.source,
        target: result.target,
      });
    } catch (error) {
      setTranslation({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      setShowTranslation(false);
    }
  }, [rawDescription, translation, tmtSecretId, tmtSecretKey]);

  return {
    isSponsor,
    translation,
    showTranslation,
    translationMode,
    setTranslationMode,
    handleTranslateDescription,
  };
};
