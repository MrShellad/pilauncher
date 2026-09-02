import React, { useState, useMemo } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface FormattedChangelogBulletProps {
  bullet: string;
}

/**
 * 独占一行的命令与代码展示框
 */
export const CommandCodeBlock: React.FC<{ code: string; label?: string }> = ({ code, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="my-2 flex flex-col overflow-hidden border-[2px] border-[#1E1E1F] bg-[#141516] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
      {label && (
        <div className="flex items-center justify-between border-b border-[#1E1E1F] bg-[#1c1d1f] px-3 py-1 text-[11px] font-bold text-ore-text-muted">
          <div className="flex items-center gap-1.5">
            <Terminal size={12} className="text-[#6CC349]" />
            <span>{label}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 overflow-x-auto select-text py-0.5">
          {!label && <Terminal size={14} className="shrink-0 text-[#6CC349]" />}
          <code className="font-mono text-xs sm:text-sm font-semibold text-[#FFE866] tracking-wide whitespace-nowrap">
            {code}
          </code>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          title="复制指令"
          className="flex shrink-0 items-center gap-1 border border-white/10 bg-[#222324] px-2 py-1 text-[11px] font-bold text-[#D0D1D4] hover:border-white/30 hover:bg-[#2c2d30] hover:text-white active:scale-95 transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={12} className="text-[#6CC349]" />
              <span className="text-[#6CC349]">已复制</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

/**
 * NBT / JSON 架构数据类型徽章渲染
 */
const renderNbtTagBadge = (type: string, key: string | number): React.ReactNode => {
  switch (type) {
    case 'FLOAT':
      return (
        <span
          key={key}
          title="单精度浮点型 (Float)"
          className="mx-0.5 inline-flex h-[19px] min-w-[19px] px-1 items-center justify-center border border-[#4a3411] bg-[#a87422] font-mono text-[11px] font-black text-white shadow-sm align-middle select-none"
        >
          F
        </span>
      );
    case 'OBJECT':
      return (
        <span
          key={key}
          title="NBT复合标签 / JSON对象 (Object)"
          className="mx-0.5 inline-flex h-[19px] px-1 items-center justify-center border border-[#1E1E1F] bg-[#3a3b3d] font-mono text-[11px] font-black text-[#FFE866] shadow-sm align-middle select-none"
        >
          &#123;&#125;
        </span>
      );
    case 'STRING':
      return (
        <span
          key={key}
          title="字符串型 (String)"
          className="mx-0.5 inline-flex h-[19px] px-1 items-center justify-center border border-[#162e13] bg-[#3C8527] font-mono text-[11px] font-black text-white shadow-sm align-middle select-none"
        >
          &quot;&quot;
        </span>
      );
    case 'INT':
      return (
        <span
          key={key}
          title="整型 (Int)"
          className="mx-0.5 inline-flex h-[19px] min-w-[19px] px-1 items-center justify-center border border-[#122A3E] bg-[#2A6592] font-mono text-[11px] font-black text-white shadow-sm align-middle select-none"
        >
          I
        </span>
      );
    case 'LIST':
      return (
        <span
          key={key}
          title="NBT列表 / JSON数组 (List)"
          className="mx-0.5 inline-flex h-[19px] px-1 items-center justify-center border border-[#3E2312] bg-[#A65B20] font-mono text-[11px] font-black text-white shadow-sm align-middle select-none"
        >
          []
        </span>
      );
    case 'BOOL':
      return (
        <span
          key={key}
          title="布尔型 (Boolean)"
          className="mx-0.5 inline-flex h-[19px] min-w-[19px] px-1 items-center justify-center border border-[#31183E] bg-[#783696] font-mono text-[11px] font-black text-white shadow-sm align-middle select-none"
        >
          B
        </span>
      );
    case 'DOUBLE':
      return (
        <span
          key={key}
          title="双精度浮点型 (Double)"
          className="mx-0.5 inline-flex h-[19px] min-w-[19px] px-1 items-center justify-center border border-[#3F1E1E] bg-[#9C3838] font-mono text-[11px] font-black text-white shadow-sm align-middle select-none"
        >
          D
        </span>
      );
    case 'LONG':
      return (
        <span
          key={key}
          title="长整型 (Long)"
          className="mx-0.5 inline-flex h-[19px] min-w-[19px] px-1 items-center justify-center border border-[#153434] bg-[#266868] font-mono text-[11px] font-black text-white shadow-sm align-middle select-none"
        >
          L
        </span>
      );
    case 'SHORT':
      return (
        <span
          key={key}
          title="短整型 (Short)"
          className="mx-0.5 inline-flex h-[19px] min-w-[19px] px-1 items-center justify-center border border-[#143038] bg-[#235b6b] font-mono text-[11px] font-black text-white shadow-sm align-middle select-none"
        >
          S
        </span>
      );
    case 'BYTE':
      return (
        <span
          key={key}
          title="字节型 (Byte)"
          className="mx-0.5 inline-flex h-[19px] min-w-[19px] px-1 items-center justify-center border border-[#2e1d3d] bg-[#5a367d] font-mono text-[11px] font-black text-white shadow-sm align-middle select-none"
        >
          B
        </span>
      );
    case 'ANY':
      return (
        <span
          key={key}
          title="任意类型 (Any)"
          className="mx-0.5 inline-flex h-[19px] min-w-[19px] px-1 items-center justify-center border border-[#2D3033] bg-[#494c50] font-mono text-[11px] font-black text-white shadow-sm align-middle select-none"
        >
          ?
        </span>
      );
    case 'REQUIRED':
      return (
        <span key={key} title="必需 / 必填字段" className="mx-0.5 inline-flex font-mono font-bold text-red-400 text-sm align-middle select-none">
          *
        </span>
      );
    default:
      return null;
  }
};

/**
 * 智能行内 Token 解析器：高亮 Minecraft ID、NBT 数据类型图标、Tag、参数占位符、组件键值等
 */
export const renderInlineTokens = (text: string): React.ReactNode[] => {
  if (!text) return [];

  // 正则匹配：
  // 1. NBT 数据类型标识: \[\[TAG:([A-Z]+)\]\]
  // 2. Minecraft 命名空间 ID: minecraft:[a-z0-9_./-]+
  // 3. 标签: #[a-z0-9_./-]+
  // 4. 占位参数: <[a-zA-Z0-9_]+> 或 \[[a-zA-Z0-9_]+\]
  // 5. 键值属性: [a-z0-9_]+=[a-z0-9_:/.-]+
  // 6. 路径: (?:/[a-z0-9_.-]+)+\.(?:json|png|nbt|mcmeta)
  // 7. 简短代码/参数标识: `[^`]+`
  const tokenRegex =
    /(\[\[TAG:([A-Z]+)\]\]|`[^`]+`|\b(?:minecraft:)[a-z0-9_./-]+|#[a-z0-9_./-]+|<[a-zA-Z0-9_]+>|\[[a-zA-Z0-9_]+\]|\b[a-z0-9_]+=[a-z0-9_:/.-]+|(?:\/[a-z0-9_.-]+)+\.(?:json|png|nbt|mcmeta)|\b(?:explosion_speed_factor|hand_animation_on_swap|effects|schedule_tick|item_model|consumable|duration|shadow_color|bee_attractive|music_volume|max_delay|min_delay|replace_current_music|weight)\b)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchStr = match[0];
    const nbtTagType = match[2];

    // 添加前面的普通文本
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    if (nbtTagType) {
      parts.push(renderNbtTagBadge(nbtTagType, matchIndex));
    } else if (matchStr.startsWith('`') && matchStr.endsWith('`')) {
      const codeContent = matchStr.slice(1, -1);
      parts.push(
        <code
          key={matchIndex}
          className="mx-0.5 inline-flex items-center border border-[#1E1E1F] bg-[#161718] px-1.5 py-0.2 font-mono text-xs font-bold text-[#FFE866] select-text shadow-sm"
        >
          {codeContent}
        </code>
      );
    } else if (matchStr.startsWith('minecraft:')) {
      parts.push(
        <code
          key={matchIndex}
          className="mx-0.5 inline-flex items-center border border-[#233820] bg-[#141b14] px-1.5 py-0.2 font-mono text-xs font-bold text-[#7CE38B] select-text shadow-sm"
        >
          {matchStr}
        </code>
      );
    } else if (matchStr.startsWith('#')) {
      parts.push(
        <code
          key={matchIndex}
          className="mx-0.5 inline-flex items-center border border-[#3b341c] bg-[#1c1a13] px-1.5 py-0.2 font-mono text-xs font-bold text-[#FFD15C] select-text shadow-sm"
        >
          {matchStr}
        </code>
      );
    } else if (matchStr.startsWith('<') && matchStr.endsWith('>')) {
      parts.push(
        <code
          key={matchIndex}
          className="mx-0.5 inline-flex items-center border border-white/10 bg-black/40 px-1 py-0.2 font-mono text-xs text-[#79C0FF] select-text"
        >
          {matchStr}
        </code>
      );
    } else if (matchStr.startsWith('[') && matchStr.endsWith(']')) {
      parts.push(
        <code
          key={matchIndex}
          className="mx-0.5 inline-flex items-center border border-white/10 bg-black/40 px-1 py-0.2 font-mono text-xs text-[#79C0FF] select-text"
        >
          {matchStr}
        </code>
      );
    } else {
      // 属性键值 / 路径 / 字段名
      parts.push(
        <code
          key={matchIndex}
          className="mx-0.5 inline-flex items-center border border-[#2D3033] bg-[#18191B] px-1.5 py-0.2 font-mono text-xs font-semibold text-[#FFA657] select-text"
        >
          {matchStr}
        </code>
      );
    }

    lastIndex = matchIndex + matchStr.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
};

/**
 * 结构化 Bullet 内容智能格式化组件
 */
export const FormattedChangelogBullet: React.FC<FormattedChangelogBulletProps> = ({ bullet }) => {
  // 1. 树状层级分支节点匹配（如 "├── ..." 或 "└── ..." 或 "│   ├── ..."）
  const treeBranchMatch = useMemo(
    () => bullet.match(/^([│\s]*(?:├──|└──|\s{2,}))\s*(.*)$/),
    [bullet]
  );

  // 2. 树状层级根节点匹配（如 "[[TAG:FLOAT]] ... 根节点"）
  const isTreeRootNode = useMemo(
    () =>
      bullet.startsWith('[[TAG:') &&
      (bullet.includes('根节点') ||
        bullet.includes('根元素') ||
        bullet.includes('父标签') ||
        bullet.includes('段落') ||
        bullet.includes('格式如下') ||
        bullet.includes('如下：')),
    [bullet]
  );

  // 3. 子标题匹配（如 "格式："、"示例："、"参数："、"文件格式如下："）
  const isSubHeading = useMemo(
    () => /^(?:(?:文件)?格式(?:如下)?|示例|参数|语法)[:：]?$/i.test(bullet.trim()),
    [bullet]
  );

  // 4. 语法行拆解（如 "语法：/<command> ..."）
  const syntaxMatch = useMemo(
    () => bullet.match(/^(?:语法(?:格式)?[:：]\s*)((\/|minecraft:)[^\n。]*)/i),
    [bullet]
  );

  // 5. 独立整行命令匹配（以 / 开头，例如 "/attribute <target> ..."）
  const pureCommandMatch = useMemo(
    () => bullet.match(/^(\/[a-z0-9_]+(?:\s+(?:<[^>]+>|\[[^\]]+\]|[a-z0-9_:.-]+))+)$/i),
    [bullet]
  );

  // 6. JSON 代码块结构检测（多行或纯 JSON 代码）
  const isJsonBlock = useMemo(
    () =>
      bullet.includes('{\n') ||
      bullet.includes('[\n') ||
      (bullet.trim().startsWith('{') && bullet.trim().endsWith('}')),
    [bullet]
  );

  // JSON 数据块（独占卡片，无圆点）
  if (isJsonBlock) {
    return (
      <div className="flex flex-col w-full my-1">
        <CommandCodeBlock code={bullet} label="JSON 数据定义" />
      </div>
    );
  }

  // 树状分支行（包含 ├── / └── 分支符号，无多余圆点）
  if (treeBranchMatch) {
    const treePrefix = treeBranchMatch[1];
    const content = treeBranchMatch[2];

    return (
      <div className="flex items-start gap-1 font-mono text-xs sm:text-sm py-0.25 leading-5">
        <span className="font-mono text-[#7A7D84] select-none whitespace-pre shrink-0 font-bold tracking-tight">
          {treePrefix}
        </span>
        <div className="flex-1 font-minecraft leading-[1.375rem] text-[#E2E4E8]">
          {renderInlineTokens(content)}
        </div>
      </div>
    );
  }

  // 树状根节点行（如 [F] [{}] 浮点数数值提供器根节点，无多余圆点）
  if (isTreeRootNode) {
    return (
      <div className="flex items-center gap-1.5 font-minecraft text-xs sm:text-sm font-bold text-white pt-1 pb-0.5 leading-snug">
        {renderInlineTokens(bullet)}
      </div>
    );
  }

  // 小节说明标题（如 "格式："，无多余圆点）
  if (isSubHeading) {
    return (
      <div className="pt-1.5 pb-0.5 text-xs font-bold text-ore-text-muted flex items-center gap-1 font-minecraft tracking-wide">
        <span className="text-[#6CC349]">◆</span>
        <span>{bullet}</span>
      </div>
    );
  }

  // 语法指令行（独占终端代码块，无多余圆点）
  if (syntaxMatch) {
    const commandCode = syntaxMatch[1].trim();
    const remaining = bullet.slice(syntaxMatch[0].length).trim();

    return (
      <div className="flex flex-col w-full my-1">
        <CommandCodeBlock code={commandCode} label="命令语法格式" />
        {remaining && (
          <span className="font-minecraft break-words text-sm text-[#E2E4E8] leading-[1.375rem] mt-0.5">
            {renderInlineTokens(remaining)}
          </span>
        )}
      </div>
    );
  }

  // 纯命令（独占终端代码块，无多余圆点）
  if (pureCommandMatch) {
    return (
      <div className="flex flex-col w-full my-1">
        <CommandCodeBlock code={pureCommandMatch[1].trim()} />
      </div>
    );
  }

  // 普通特性与更新条目（带 Minecraft 绿色像素小方块）
  return (
    <div className="flex items-start gap-2.5 text-sm text-[#E2E4E8] leading-[1.375rem] tracking-wide">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#6CC349] shadow-[1px_1px_0_rgba(0,0,0,0.4)]" />
      <span className="flex-1 font-minecraft break-words selection:bg-[#3C8527] selection:text-white">
        {renderInlineTokens(bullet)}
      </span>
    </div>
  );
};
