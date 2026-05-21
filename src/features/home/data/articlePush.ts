export interface ArticlePush {
  id: string;
  title: string;
  cover: string;
  content: string;
  relatedLink: string;
  category: string;
  enabled: boolean;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const ARTICLE_PUSH_BASE_URL = 'https://pil.nav4ai.net';
export const ARTICLE_PUSH_LATEST_API_URL = `${ARTICLE_PUSH_BASE_URL}/api/article-pushes/latest`;
export const ARTICLE_PUSH_LAST_PROMPTED_KEY = 'pil_article_push_last_prompted';

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

const resolveUrl = (value?: string | null) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  try {
    return new URL(trimmed, `${ARTICLE_PUSH_BASE_URL}/`).toString();
  } catch {
    return '';
  }
};

const resolveHttpUrl = (value?: string | null) => {
  const resolved = resolveUrl(value);
  if (!resolved) return '';

  try {
    const url = new URL(resolved);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

export const resolveArticlePushAssetUrl = resolveHttpUrl;
export const resolveArticlePushExternalUrl = resolveHttpUrl;

export const getArticlePushPromptKey = (push: ArticlePush) =>
  `${push.id}:${push.updatedAt || push.createdAt || ''}`;

export const formatArticlePushDateTime = (value?: string | null) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace('T', ' ').slice(0, 16);
};

export const normalizeArticlePushHtml = (html: string) => {
  if (typeof DOMParser === 'undefined') {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<main>${html}</main>`, 'text/html');
  const container = doc.body.querySelector('main');

  if (!container) {
    return html;
  }

  container.querySelectorAll<HTMLImageElement | HTMLIFrameElement | HTMLVideoElement | HTMLSourceElement>('[src]').forEach((node) => {
    const resolved = resolveArticlePushAssetUrl(node.getAttribute('src'));
    if (resolved) {
      node.setAttribute('src', resolved);
    } else {
      node.removeAttribute('src');
    }
  });

  container.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const resolved = resolveArticlePushExternalUrl(anchor.getAttribute('href'));
    if (resolved) {
      anchor.setAttribute('href', resolved);
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noreferrer');
    } else {
      anchor.removeAttribute('href');
    }
  });

  return container.innerHTML;
};
