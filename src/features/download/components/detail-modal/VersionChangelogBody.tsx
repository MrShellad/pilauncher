import React from 'react';

import type {
  ChangelogTranslationState,
  TranslationMode,
} from '../../hooks/useVersionChangelogTranslation';

interface VersionChangelogBodyProps {
  body?: string | null;
  isShowingTranslation: boolean;
  noChangelogText: string;
  originalBody: string;
  translation?: ChangelogTranslationState;
  translationMode: TranslationMode;
}

const cleanLine = (line: string) => {
  const trimmed = line.trim();
  if (trimmed.startsWith('### ')) return trimmed.replace(/^###\s+/, '');
  if (trimmed.startsWith('## ')) return trimmed.replace(/^##\s+/, '');
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return trimmed.replace(/^[-*]\s+/, '');
  return line;
};

const BilingualChangelog: React.FC<{ originalBody: string; translatedBody: string }> = ({
  originalBody,
  translatedBody,
}) => {
  const originalLines = originalBody.split('\n');
  const translatedLines = translatedBody.split('\n');
  const maxLines = Math.max(originalLines.length, translatedLines.length);
  const formattedLines: React.ReactNode[] = [];

  for (let index = 0; index < maxLines; index++) {
    const original = originalLines[index];
    const translated = translatedLines[index];

    if (original === undefined && translated === undefined) continue;

    const trimmedOriginal = original?.trim() || '';

    if (!trimmedOriginal && !translated?.trim()) {
      formattedLines.push(<div key={index} className="h-[0.25rem]" />);
      continue;
    }

    if (trimmedOriginal.startsWith('### ')) {
      formattedLines.push(
        <div key={index} className="pt-[0.625rem] pb-[0.25rem] first:pt-0">
          <div className="font-minecraft text-[0.875rem] font-bold leading-[1.35] text-white/40 break-words tracking-[0.02em]">
            {cleanLine(trimmedOriginal)}
          </div>
          <div className="font-minecraft text-[0.875rem] font-bold leading-[1.35] text-white break-words mt-[0.125rem] tracking-[0.02em]">
            {cleanLine(translated || '')}
          </div>
        </div>
      );
      continue;
    }

    if (trimmedOriginal.startsWith('## ')) {
      formattedLines.push(
        <div key={index} className="pt-[0.75rem] pb-[0.25rem] first:pt-0">
          <div className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349]/40 break-words tracking-[0.02em]">
            {cleanLine(trimmedOriginal)}
          </div>
          <div className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349] break-words mt-[0.125rem] tracking-[0.02em]">
            {cleanLine(translated || '')}
          </div>
        </div>
      );
      continue;
    }

    if (trimmedOriginal.startsWith('- ') || trimmedOriginal.startsWith('* ')) {
      formattedLines.push(
        <div key={index} className="flex items-start gap-[0.5rem] font-minecraft text-[0.8125rem] leading-[1.55] pt-[0.25rem]">
          <span className="mt-[0.0625rem] text-[#6CC349]">-</span>
          <div className="flex-1 min-w-0">
            <div className="text-[#E6E8EB]/40 break-words font-medium">
              {cleanLine(trimmedOriginal)}
            </div>
            <div className="text-[#E6E8EB] break-words mt-[0.125rem] font-medium">
              {cleanLine(translated || '')}
            </div>
          </div>
        </div>
      );
      continue;
    }

    formattedLines.push(
      <div key={index} className="pt-[0.25rem]">
        <div className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]/40 font-medium">
          {original || ''}
        </div>
        <div className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB] mt-[0.125rem] font-medium">
          {translated || ''}
        </div>
      </div>
    );
  }

  return <div className="space-y-[0.375rem]">{formattedLines}</div>;
};

const MonolingualChangelog: React.FC<{ body: string }> = ({ body }) => (
  <div className="space-y-[0.375rem]">
    {body.split('\n').map((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('### ')) {
        return (
          <h3 key={index} className="pt-[0.625rem] font-minecraft text-[0.875rem] font-bold leading-[1.35] text-white first:pt-0">
            {trimmedLine.replace(/^###\s+/, '')}
          </h3>
        );
      }
      if (trimmedLine.startsWith('## ')) {
        return (
          <h2 key={index} className="pt-[0.75rem] font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349] first:pt-0">
            {trimmedLine.replace(/^##\s+/, '')}
          </h2>
        );
      }
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        return (
          <div key={index} className="flex items-start gap-[0.5rem] font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]">
            <span className="mt-[0.0625rem] text-[#6CC349]">-</span>
            <span className="min-w-0 break-words">{trimmedLine.replace(/^[-*]\s+/, '')}</span>
          </div>
        );
      }
      if (!trimmedLine) {
        return <div key={index} className="h-[0.25rem]" />;
      }
      return (
        <p key={index} className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]">
          {line}
        </p>
      );
    })}
  </div>
);

export const VersionChangelogBody: React.FC<VersionChangelogBodyProps> = ({
  body,
  isShowingTranslation,
  noChangelogText,
  originalBody,
  translation,
  translationMode,
}) => {
  if (!body?.trim()) {
    return (
      <p className="font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]">
        {noChangelogText}
      </p>
    );
  }

  if (isShowingTranslation && translation?.status === 'translated' && translationMode === 'bilingual') {
    return <BilingualChangelog originalBody={originalBody} translatedBody={translation.text} />;
  }

  return <MonolingualChangelog body={body} />;
};
