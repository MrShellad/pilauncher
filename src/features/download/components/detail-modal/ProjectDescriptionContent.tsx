import React from 'react';
import {
  renderMarkdownInlineSafe,
  renderMarkdownSafe,
} from '../../logic/sanitizeDescription';

interface ProjectDescriptionContentProps {
  originalBody: string;
  translatedBody?: string;
  bilingual: boolean;
  emptyDescription: string;
}

const cleanLine = (line: string) => {
  const trimmed = line.trim();
  if (trimmed.startsWith('### ')) return trimmed.replace(/^###\s+/, '');
  if (trimmed.startsWith('## ')) return trimmed.replace(/^##\s+/, '');
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return trimmed.replace(/^[-*]\s+/, '');
  return line;
};

const BilingualDescription: React.FC<{ originalBody: string; translatedBody: string }> = ({
  originalBody,
  translatedBody,
}) => {
  const originalLines = originalBody.split('\n');
  const translatedLines = translatedBody.split('\n');
  const maxLines = Math.max(originalLines.length, translatedLines.length);
  const formattedLines: React.ReactNode[] = [];

  for (let index = 0; index < maxLines; index += 1) {
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
          <div
            className="font-minecraft text-[0.875rem] font-bold leading-[1.35] text-[#C6C8CB]/60 break-words tracking-[0.02em] markdown-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(trimmedOriginal)) }}
          />
          <div
            className="font-minecraft text-[0.875rem] font-bold leading-[1.35] text-white ore-text-shadow break-words mt-[0.125rem] tracking-[0.02em] markdown-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(translated || '')) }}
          />
        </div>,
      );
      continue;
    }

    if (trimmedOriginal.startsWith('## ')) {
      formattedLines.push(
        <div key={index} className="pt-[0.75rem] pb-[0.25rem] first:pt-0">
          <div
            className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349]/60 break-words tracking-[0.02em] markdown-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(trimmedOriginal)) }}
          />
          <div
            className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349] ore-text-shadow break-words mt-[0.125rem] tracking-[0.02em] markdown-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(translated || '')) }}
          />
        </div>,
      );
      continue;
    }

    if (trimmedOriginal.startsWith('- ') || trimmedOriginal.startsWith('* ')) {
      formattedLines.push(
        <div key={index} className="flex items-start gap-[0.5rem] font-minecraft text-[0.8125rem] leading-[1.55] pt-[0.25rem] markdown-content">
          <span className="mt-[0.0625rem] text-[#6CC349]">-</span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[#C6C8CB]/60 break-words font-medium"
              dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(trimmedOriginal)) }}
            />
            <div
              className="text-[#F2F2F2] break-words mt-[0.125rem] font-medium"
              dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(translated || '')) }}
            />
          </div>
        </div>,
      );
      continue;
    }

    formattedLines.push(
      <div key={index} className="pt-[0.25rem] markdown-content">
        <div
          className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#C6C8CB]/60 font-medium"
          dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(original || '') }}
        />
        <div
          className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#F2F2F2] mt-[0.125rem] font-medium"
          dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(translated || '') }}
        />
      </div>,
    );
  }

  return <div className="space-y-[0.375rem]">{formattedLines}</div>;
};

export const ProjectDescriptionContent: React.FC<ProjectDescriptionContentProps> = ({
  originalBody,
  translatedBody,
  bilingual,
  emptyDescription,
}) => {
  if (bilingual && translatedBody) {
    return <BilingualDescription originalBody={originalBody} translatedBody={translatedBody} />;
  }

  const body = translatedBody ?? originalBody;
  if (!body.trim()) {
    return (
      <p className="font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]">
        {emptyDescription}
      </p>
    );
  }

  return (
    <div
      className="markdown-content font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]"
      dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(body) }}
    />
  );
};
