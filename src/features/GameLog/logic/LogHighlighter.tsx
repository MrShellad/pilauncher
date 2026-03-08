// src/features/GameLog/logic/LogHighlighter.tsx
import React from 'react';

// 定义高亮规则接口
export interface LogHighlightRule {
  pattern: RegExp;
  className: string;
}

// 默认的高亮规则
export const defaultHighlightRules: LogHighlightRule[] = [
  { pattern: /\[INFO\]|INFO/g, className: 'text-blue-400' },
  { pattern: /\[WARN\]|WARN|WARNING/g, className: 'text-yellow-400' },
  { pattern: /\[ERROR\]|ERROR|FATAL/g, className: 'text-red-500 font-bold' },
  { pattern: /Exception in thread|at java\.|at net\.minecraft\./g, className: 'text-red-400 bg-red-900/20 px-1' },
  { pattern: /\[DEBUG\]|DEBUG/g, className: 'text-gray-500' },
];

/**
 * 极其高效的简易高亮渲染器
 * 它会将匹配到的关键字用 span 包裹并加上 Tailwind 类名
 */
export const renderHighlightedLog = (line: string, rules: LogHighlightRule[] = defaultHighlightRules): React.ReactNode => {
  let result: React.ReactNode[] = [line];

  rules.forEach(rule => {
    const newResult: React.ReactNode[] = [];
    result.forEach(chunk => {
      if (typeof chunk !== 'string') {
        newResult.push(chunk);
        return;
      }

      const parts = chunk.split(rule.pattern);
      const matches = chunk.match(rule.pattern);

      if (!matches) {
        newResult.push(chunk);
        return;
      }

      parts.forEach((part, i) => {
        newResult.push(part);
        if (i < matches.length) {
          // React key 在这里用 i 足矣，因为是单行内的静态拆分
          newResult.push(<span key={i} className={rule.className}>{matches[i]}</span>);
        }
      });
    });
    result = newResult;
  });

  return result;
};