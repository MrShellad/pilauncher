import { marked } from 'marked';

/**
 * Parses and sanitizes project descriptions (Markdown / HTML) from Modrinth / CurseForge.
 * 
 * Objectives:
 * 1. Security: Strip dangerous executable tags (<script>, <object>, <embed>, <applet>, etc.) and inline event handlers.
 * 2. WebView2 Stability: YouTube / external <iframe> embeds load third-party scripts (e.g. Google Botguard)
 *    and call WebGPU fingerprinting APIs that crash WebView2 or throw:
 *    "Uncaught TypeError: Cannot read properties of undefined (reading 'plugins')"
 *    Instead, we safely convert <iframe> video embeds into native-feeling OreUI media cards that open in the system browser.
 * 3. Spatial Navigation: Prevent external iframes from trapping keyboard / gamepad focus.
 */

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

function extractBilibiliBvid(url: string): string | null {
  const match = url.match(/(?:bilibili\.com\/(?:video\/|player\.html\?.*?\bbvid=))(BV[a-zA-Z0-9]+)/i);
  return match ? match[1] : null;
}

function createEmbedReplacement(doc: Document, src: string): HTMLElement {
  const card = doc.createElement('a');
  card.className = 'ore-media-card';
  card.setAttribute('target', '_blank');
  card.setAttribute('rel', 'noopener noreferrer');

  const ytId = extractYouTubeId(src);
  if (ytId) {
    const watchUrl = `https://www.youtube.com/watch?v=${ytId}`;
    const thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    card.setAttribute('href', watchUrl);
    card.classList.add('ore-media-youtube');
    card.innerHTML = `
      <div class="ore-media-thumb-container">
        <img src="${thumbUrl}" alt="YouTube video thumbnail" class="ore-media-thumb-img" loading="lazy" />
        <div class="ore-media-overlay">
          <div class="ore-media-play-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
          </div>
        </div>
      </div>
      <div class="ore-media-details">
        <div class="ore-media-header">
          <span class="ore-media-badge ore-badge-youtube">YouTube</span>
          <span class="ore-media-prompt">点击在浏览器中打开观看</span>
        </div>
        <div class="ore-media-url">${watchUrl}</div>
      </div>
    `;
    return card;
  }

  const biliBvid = extractBilibiliBvid(src);
  if (biliBvid) {
    const watchUrl = `https://www.bilibili.com/video/${biliBvid}`;
    card.setAttribute('href', watchUrl);
    card.classList.add('ore-media-bilibili');
    card.innerHTML = `
      <div class="ore-media-thumb-container ore-media-bilibili-placeholder">
        <div class="ore-media-play-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
        </div>
      </div>
      <div class="ore-media-details">
        <div class="ore-media-header">
          <span class="ore-media-badge ore-badge-bilibili">哔哩哔哩 Bilibili</span>
          <span class="ore-media-prompt">点击在浏览器中打开观看 (${biliBvid})</span>
        </div>
        <div class="ore-media-url">${watchUrl}</div>
      </div>
    `;
    return card;
  }

  // Generic iframe
  let fullUrl = src;
  let domain = '外部内容';
  try {
    const urlObj = new URL(src.startsWith('//') ? `https:${src}` : src);
    fullUrl = urlObj.href;
    domain = urlObj.hostname;
  } catch {
    // fallback
  }

  card.setAttribute('href', fullUrl);
  card.classList.add('ore-media-generic');
  card.innerHTML = `
    <div class="ore-media-thumb-container ore-media-generic-placeholder">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
    </div>
    <div class="ore-media-details">
      <div class="ore-media-header">
        <span class="ore-media-badge">外部嵌入</span>
        <span class="ore-media-prompt">点击在浏览器中安全打开 (${domain})</span>
      </div>
      <div class="ore-media-url">${fullUrl}</div>
    </div>
  `;
  return card;
}

export function sanitizeDescriptionHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // 1. Remove dangerous script and embedding tags
    const dangerousElements = doc.querySelectorAll('script, object, embed, applet, meta, base, form');
    dangerousElements.forEach((el) => el.remove());

    // 2. Replace <iframe> with OreUI media preview cards
    const iframes = doc.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      const src = iframe.getAttribute('src') || '';
      if (!src.trim()) {
        iframe.remove();
      } else {
        const replacement = createEmbedReplacement(doc, src);
        iframe.replaceWith(replacement);
      }
    });

    // 3. Sanitize all remaining elements
    const all = doc.querySelectorAll('*');
    all.forEach((el) => {
      // Remove inline event handlers
      const toRemove: string[] = [];
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const name = attr.name.toLowerCase();
        const val = attr.value.toLowerCase();
        if (name.startsWith('on')) {
          toRemove.push(attr.name);
        }
        if ((name === 'href' || name === 'src') && val.replace(/\s+/g, '').startsWith('javascript:')) {
          toRemove.push(attr.name);
        }
      }
      toRemove.forEach((attrName) => el.removeAttribute(attrName));

      // Enforce safe link target
      if (el.tagName.toLowerCase() === 'a') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }

      // Lazy load images
      if (el.tagName.toLowerCase() === 'img') {
        el.setAttribute('loading', 'lazy');
      }

      // Safe video playback (no autoplay)
      if (el.tagName.toLowerCase() === 'video') {
        el.removeAttribute('autoplay');
        el.setAttribute('controls', 'true');
        el.setAttribute('preload', 'metadata');
      }
    });

    return doc.body.innerHTML;
  } catch (error) {
    console.warn('Failed to sanitize description HTML:', error);
    return rawHtml;
  }
}

export function renderMarkdownSafe(markdown: string): string {
  if (!markdown) return '';
  try {
    const rawHtml = marked.parse(markdown) as string;
    return sanitizeDescriptionHtml(rawHtml);
  } catch {
    return sanitizeDescriptionHtml(markdown);
  }
}

export function renderMarkdownInlineSafe(markdown: string): string {
  if (!markdown) return '';
  try {
    const rawHtml = marked.parseInline(markdown) as string;
    return sanitizeDescriptionHtml(rawHtml);
  } catch {
    return sanitizeDescriptionHtml(markdown);
  }
}
