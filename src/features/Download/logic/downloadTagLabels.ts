import type { TFunction } from 'i18next';

export interface DownloadTagOptionLike {
  label?: string;
  value?: string;
  slug?: string;
  translationKey?: string;
  defaultLabel?: string;
  labels?: Record<string, string>;
}

const ACRONYM_PARTS: Record<string, string> = {
  api: 'API',
  gui: 'GUI',
  pbr: 'PBR',
  rpg: 'RPG'
};

export const prettifyDownloadTagLabel = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return '';

  if (/^\d+x[+-]?$/i.test(normalized)) return normalized;
  if (/^pbr$/i.test(normalized)) return 'PBR';

  return normalized
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => {
      const lowerPart = part.toLowerCase();
      const acronym = ACRONYM_PARTS[lowerPart];
      if (acronym) return acronym;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
};

export const normalizeDownloadTagKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\+/g, '_plus_')
    .replace(/([a-z0-9])-(?=$|[^a-z0-9])/g, '$1_minus_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const getDownloadCategoryTranslationKey = (raw: string) =>
  `download.categories.${normalizeDownloadTagKey(raw)}`;

interface DownloadTagLabelOptions {
  t: TFunction;
  language?: string;
  source?: string;
  raw: string;
  display?: string;
  translationKey?: string;
  defaultLabel?: string;
  labels?: Record<string, string>;
}

const getLookupKeys = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return [];

  return Array.from(
    new Set([
      normalized.toLowerCase(),
      normalizeDownloadTagKey(normalized)
    ])
  );
};

const resolveConfiguredLabel = (labels?: Record<string, string>, language?: string) => {
  if (!labels) return '';

  const exact = language ? labels[language] : '';
  if (exact) return exact;

  const baseLanguage = language?.split('-')[0];
  if (baseLanguage) {
    const matchedEntry = Object.entries(labels).find(([key]) => key.split('-')[0] === baseLanguage);
    if (matchedEntry?.[1]) return matchedEntry[1];
  }

  return labels['en-US'] || labels.en || Object.values(labels)[0] || '';
};

export const findDownloadTagOption = (
  options: DownloadTagOptionLike[],
  raw: string,
  display?: string
) => {
  const candidateKeys = new Set([
    ...getLookupKeys(raw),
    ...getLookupKeys(display)
  ]);

  return options.find((option) =>
    [option.value, option.slug, option.label]
      .flatMap((value) => getLookupKeys(value))
      .some((key) => candidateKeys.has(key))
  );
};

export const getLocalizedDownloadTagLabel = ({
  t,
  language,
  raw,
  display,
  translationKey,
  defaultLabel,
  labels
}: DownloadTagLabelOptions) => {
  const configuredLabel = resolveConfiguredLabel(labels, language);
  const fallbackLabel = configuredLabel || defaultLabel || prettifyDownloadTagLabel(display || raw);
  const resolvedTranslationKey = translationKey || (raw ? getDownloadCategoryTranslationKey(raw) : '');

  if (resolvedTranslationKey) {
    const translatedLabel = t(resolvedTranslationKey, { defaultValue: '' });
    if (typeof translatedLabel === 'string' && translatedLabel.trim().length > 0 && translatedLabel !== resolvedTranslationKey) {
      return translatedLabel;
    }
  }

  return fallbackLabel;
};

export const getLocalizedDownloadOptionLabel = ({
  t,
  language,
  option
}: {
  t: TFunction;
  language?: string;
  option: DownloadTagOptionLike;
}) => {
  const raw = option.slug || option.label || option.value || '';

  return getLocalizedDownloadTagLabel({
    t,
    language,
    raw,
    display: option.label,
    translationKey: option.translationKey,
    defaultLabel: option.defaultLabel || prettifyDownloadTagLabel(option.label || raw),
    labels: option.labels
  });
};
