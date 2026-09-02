/**
 * Minecraft Wiki 结构化更新日志拉取与解析服务
 * 用于将 zh.minecraft.wiki / minecraft.wiki 的版本页面解析为 OreUI 结构化卡片流
 */

export interface ChangelogEntry {
  id: string;
  name: string;
  subCategory: string; // e.g. "方块", "物品", "生物", "世界生成", "游戏内容", "命令格式", "常规"
  mainCategory: 'additions' | 'changes' | 'fixes' | 'other';
  mainCategoryLabel: string; // "新内容", "更改", "修复"
  iconUrl?: string;
  bullets: string[];
}

export interface StructuredChangelog {
  version: string;
  pageTitle: string;
  wikiUrl: string;
  availableMainCategories: { id: 'additions' | 'changes' | 'fixes' | 'other'; label: string; count: number }[];
  availableSubCategories: string[];
  entries: ChangelogEntry[];
}

const WIKI_CACHE = new Map<string, StructuredChangelog>();

/**
 * 格式化图片链接为绝对路径
 */
function resolveWikiImageUrl(src: string | null | undefined, baseUrl: string): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('//')) return `https:${src}`;
  if (src.startsWith('/')) return `${baseUrl}${src}`;
  return `${baseUrl}/${src}`;
}

/**
 * 将 DOM 中的 NBT 图标与指标转换为结构化 Tag 标识
 */
function convertNbtIcons(root: Element): void {
  root.querySelectorAll('.nbt-icon').forEach((icon) => {
    const img = icon.querySelector('img');
    const title = img?.getAttribute('title') || img?.getAttribute('alt') || '';
    const src = img?.getAttribute('src') || '';

    let tag = '';
    if (/单精度浮点|Float/i.test(title) || /Data_node_float/i.test(src)) {
      tag = '[[TAG:FLOAT]]';
    } else if (/NBT复合标签|JSON对象|Structure/i.test(title) || /Data_node_structure/i.test(src)) {
      tag = '[[TAG:OBJECT]]';
    } else if (/字符串|String/i.test(title) || /Data_node_string/i.test(src)) {
      tag = '[[TAG:STRING]]';
    } else if (/整型|Int/i.test(title) || /Data_node_int/i.test(src)) {
      tag = '[[TAG:INT]]';
    } else if (/NBT列表|JSON数组|List/i.test(title) || /Data_node_list/i.test(src)) {
      tag = '[[TAG:LIST]]';
    } else if (/布尔型|Bool/i.test(title) || /Data_node_bool/i.test(src)) {
      tag = '[[TAG:BOOL]]';
    } else if (/双精度浮点|Double/i.test(title) || /Data_node_double/i.test(src)) {
      tag = '[[TAG:DOUBLE]]';
    } else if (/长整型|Long/i.test(title) || /Data_node_long/i.test(src)) {
      tag = '[[TAG:LONG]]';
    } else if (/短整型|Short/i.test(title) || /Data_node_short/i.test(src)) {
      tag = '[[TAG:SHORT]]';
    } else if (/字节型|Byte/i.test(title) || /Data_node_byte/i.test(src)) {
      tag = '[[TAG:BYTE]]';
    } else if (/任意类型|Any/i.test(title) || /Data_node_any/i.test(src)) {
      tag = '[[TAG:ANY]]';
    }

    if (tag) {
      icon.replaceWith(` ${tag} `);
    }
  });

  // 处理必填标记 .nbt-indicators 或带星号 *
  root.querySelectorAll('.nbt-indicators, .nbt-required').forEach((ind) => {
    if (ind.textContent?.includes('*') || ind.innerHTML.includes('*')) {
      ind.replaceWith(' [[TAG:REQUIRED]] ');
    }
  });

  // 处理 .nbt-title
  root.querySelectorAll('.nbt-title').forEach((titleEl) => {
    const text = titleEl.textContent?.trim();
    if (text) {
      titleEl.replaceWith(` \`${text}\` `);
    }
  });
}

/**
 * 解析 Wiki 中的 <div class="treeview"> 树形结构
 */
function parseTreeviewElement(treeviewEl: Element): string[] {
  const result: string[] = [];
  const clone = treeviewEl.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('.mw-editsection, .reference, style, script').forEach((el) => el.remove());
  convertNbtIcons(clone);

  clone.querySelectorAll('code, kbd, tt').forEach((el) => {
    const text = el.textContent?.trim();
    if (text) {
      el.replaceWith(` \`${text}\` `);
    }
  });

  const traverseUl = (ul: Element, currentPrefix = '', isRoot = false) => {
    const lis = Array.from(ul.children).filter((c) => c.tagName.toLowerCase() === 'li');
    lis.forEach((li, idx) => {
      const isLastChild = idx === lis.length - 1;
      const branchSymbol = isRoot ? '' : isLastChild ? '└── ' : '├── ';
      const childPrefix = isRoot ? '' : currentPrefix + (isLastChild ? '    ' : '│   ');

      const subUl = li.querySelector(':scope > ul');
      let directText = '';
      if (subUl) {
        const liClone = li.cloneNode(true) as HTMLElement;
        liClone.querySelector(':scope > ul')?.remove();
        directText = (liClone.textContent || '').replace(/\s+/g, ' ').trim();
      } else {
        directText = (li.textContent || '').replace(/\s+/g, ' ').trim();
      }

      if (directText) {
        result.push(`${currentPrefix}${branchSymbol}${directText}`);
      }

      if (subUl) {
        traverseUl(subUl, childPrefix, false);
      }
    });
  };

  const rootUls = clone.querySelectorAll(':scope > dl > dd > ul, :scope > ul');
  if (rootUls.length > 0) {
    rootUls.forEach((rootUl) => traverseUl(rootUl, '', true));
  } else {
    const anyUl = clone.querySelector('ul');
    if (anyUl) {
      traverseUl(anyUl, '', true);
    }
  }

  return result;
}

/**
 * 清理富文本列表节点，提取可读文字并保留代码标记
 */
function cleanBulletText(li: Element): string {
  // 克隆节点避免污染
  const clone = li.cloneNode(true) as HTMLElement;

  // 移除无用的编辑/折叠元素
  clone.querySelectorAll('.mw-editsection, .reference, .toctogglecheckbox, style, script').forEach((el) => el.remove());

  // 转换 NBT 数据类型图标
  convertNbtIcons(clone);

  // 保留代码标记
  clone.querySelectorAll('code, kbd, tt').forEach((el) => {
    const text = el.textContent?.trim();
    if (text) {
      el.replaceWith(` \`${text}\` `);
    }
  });

  // 提取文本
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * 从 HTML 解析结构化更新日志
 */
function parseChangelogHtml(
  rawHtml: string,
  version: string,
  pageTitle: string,
  baseUrl: string
): StructuredChangelog {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // 移除 TOC 目录与编辑标记
  doc.querySelectorAll('#toc, .mw-editsection, .navbox, .metadata').forEach((el) => el.remove());

  const entries: ChangelogEntry[] = [];
  let currentMainCategory: 'additions' | 'changes' | 'fixes' | 'other' = 'additions';
  let currentMainCategoryLabel = '新内容';
  let currentSubCategory = '常规';

  // 遍历所有顶层子节点或标题与段落
  const contentContainer = doc.querySelector('.mw-parser-output') || doc.body;
  const elements = Array.from(contentContainer.children);

  let currentItemName = '';
  let currentItemBullets: string[] = [];
  let currentItemIcon: string | undefined = undefined;

  const flushCurrentItem = () => {
    if (currentItemName && currentItemBullets.length > 0) {
      entries.push({
        id: `${currentMainCategory}-${currentSubCategory}-${currentItemName}-${entries.length}`,
        name: currentItemName,
        subCategory: currentSubCategory,
        mainCategory: currentMainCategory,
        mainCategoryLabel: currentMainCategoryLabel,
        iconUrl: currentItemIcon,
        bullets: [...currentItemBullets],
      });
    }
    currentItemName = '';
    currentItemBullets = [];
    currentItemIcon = undefined;
  };

  for (const el of elements) {
    const tagName = el.tagName.toLowerCase();
    const headingText = el.textContent?.trim() || '';

    // 1. 匹配主分类标题 (H2)
    if (tagName === 'h2' || el.querySelector('h2')) {
      flushCurrentItem();
      const h2Text = (el.querySelector('h2')?.textContent || headingText).trim();
      if (h2Text.includes('新内容') || /additions/i.test(h2Text)) {
        currentMainCategory = 'additions';
        currentMainCategoryLabel = '新内容';
      } else if (h2Text.includes('更改') || /changes/i.test(h2Text)) {
        currentMainCategory = 'changes';
        currentMainCategoryLabel = '更改';
      } else if (h2Text.includes('修复') || /fixes|bug/i.test(h2Text)) {
        currentMainCategory = 'fixes';
        currentMainCategoryLabel = '修复';
      } else {
        currentMainCategory = 'other';
        currentMainCategoryLabel = h2Text || '其他';
      }
      currentSubCategory = '常规';
      continue;
    }

    // 2. 匹配子分类标题 (H3)
    if (tagName === 'h3' || el.querySelector('h3')) {
      flushCurrentItem();
      const h3Text = (el.querySelector('h3')?.textContent || headingText).trim();
      currentSubCategory = h3Text.replace(/\[.*\]/g, '').trim() || '常规';
      continue;
    }

    // 3. 匹配具体条目标题 (p > b 或 p > a > b 或 dt)
    const boldEl = el.querySelector('p > b, p > strong, dt > b');
    if (boldEl && boldEl.textContent?.trim()) {
      flushCurrentItem();
      currentItemName = boldEl.textContent.trim();

      // 提取条目内潜在的图片
      const img = el.querySelector('img');
      if (img) {
        currentItemIcon = resolveWikiImageUrl(img.getAttribute('src'), baseUrl);
      }
      continue;
    }

    // 4. 匹配 Treeview 树形结构容器
    if (el.classList.contains('treeview') || el.querySelector('.treeview')) {
      const treeEl = el.classList.contains('treeview') ? el : el.querySelector('.treeview')!;
      const treeLines = parseTreeviewElement(treeEl);
      if (treeLines.length > 0) {
        if (!currentItemName) {
          currentItemName = currentSubCategory;
        }
        currentItemBullets.push(...treeLines);
      }
      continue;
    }

    // 5. 匹配 JSON / 代码高亮展示块
    const preEl = el.querySelector('.mw-highlight pre, pre');
    if (preEl && preEl.textContent?.trim()) {
      if (!currentItemName) {
        currentItemName = currentSubCategory;
      }
      const codeText = preEl.textContent.trim();
      currentItemBullets.push(codeText);
      continue;
    }

    // 6. 匹配条目列表 (ul / ol)
    if (tagName === 'ul' || tagName === 'ol') {
      const lis = Array.from(el.querySelectorAll(':scope > li'));
      if (lis.length > 0) {
        // 如果前面没有显式的 <b> 作为标题，使用第一个 li 或子分类名作为条目
        if (!currentItemName) {
          if (currentMainCategory === 'fixes') {
            // Bug 修复列表每一条都是一个 Bug
            for (const li of lis) {
              const text = cleanBulletText(li);
              if (text) {
                entries.push({
                  id: `fix-${entries.length}`,
                  name: text.split('–')[0]?.split('-')[0]?.trim() || 'Bug 修复',
                  subCategory: '修复',
                  mainCategory: 'fixes',
                  mainCategoryLabel: '修复',
                  bullets: [text],
                });
              }
            }
            continue;
          } else {
            currentItemName = currentSubCategory;
          }
        }

        for (const li of lis) {
          const text = cleanBulletText(li);
          if (text) {
            currentItemBullets.push(text);
          }
        }
      }
      continue;
    }

    // 7. 段落补充文本
    if (tagName === 'p' && !boldEl && el.textContent?.trim()) {
      if (currentItemName) {
        currentItemBullets.push(el.textContent.trim());
      }
    }
  }

  flushCurrentItem();

  // 统计主分类与子分类
  const mainCategoryCounts = {
    additions: entries.filter((e) => e.mainCategory === 'additions').length,
    changes: entries.filter((e) => e.mainCategory === 'changes').length,
    fixes: entries.filter((e) => e.mainCategory === 'fixes').length,
    other: entries.filter((e) => e.mainCategory === 'other').length,
  };

  const availableMainCategories: StructuredChangelog['availableMainCategories'] = [];
  if (mainCategoryCounts.additions > 0) {
    availableMainCategories.push({ id: 'additions', label: '新内容', count: mainCategoryCounts.additions });
  }
  if (mainCategoryCounts.changes > 0) {
    availableMainCategories.push({ id: 'changes', label: '更改', count: mainCategoryCounts.changes });
  }
  if (mainCategoryCounts.fixes > 0) {
    availableMainCategories.push({ id: 'fixes', label: '修复', count: mainCategoryCounts.fixes });
  }
  if (mainCategoryCounts.other > 0) {
    availableMainCategories.push({ id: 'other', label: '其他', count: mainCategoryCounts.other });
  }

  const subCategories = Array.from(new Set(entries.map((e) => e.subCategory)));

  return {
    version,
    pageTitle,
    wikiUrl: `${baseUrl}/w/${encodeURIComponent(pageTitle)}`,
    availableMainCategories,
    availableSubCategories: subCategories,
    entries,
  };
}

/**
 * 拉取并解析指定版本的结构化更新日志
 */
export async function fetchWikiStructuredChangelog(
  version: string,
  lang: 'zh' | 'en' = 'zh'
): Promise<StructuredChangelog | null> {
  const cacheKey = `${lang}-${version}`;
  if (WIKI_CACHE.has(cacheKey)) {
    return WIKI_CACHE.get(cacheKey)!;
  }

  const baseUrl = lang === 'zh' ? 'https://zh.minecraft.wiki' : 'https://minecraft.wiki';
  const pagePrefix = lang === 'zh' ? 'Java版' : 'Java Edition ';
  const pageTitle = `${pagePrefix}${version}`;

  try {
    const url = `${baseUrl}/api.php?action=parse&page=${encodeURIComponent(
      pageTitle
    )}&prop=text&format=json&formatversion=2&origin=*`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PiLauncher/1.0.0 (https://github.com/MrShellad/pilauncher)',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    if (data.error || !data.parse?.text) {
      // 尝试自动容错：移除空格或补充空格
      console.warn(`Wiki page not found for "${pageTitle}":`, data.error);
      return null;
    }

    const structured = parseChangelogHtml(data.parse.text, version, pageTitle, baseUrl);
    WIKI_CACHE.set(cacheKey, structured);
    return structured;
  } catch (err) {
    console.error('Failed to fetch structured wiki changelog:', err);
    return null;
  }
}
