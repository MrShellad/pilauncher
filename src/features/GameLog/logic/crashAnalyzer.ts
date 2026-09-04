// src/features/GameLog/logic/crashAnalyzer.ts
import crashRulesData from '../data/crashRules.json';

export type CrashCategory =
  | 'memory'
  | 'java'
  | 'mod'
  | 'system'
  | 'auth'
  | 'graphics'
  | 'filesystem'
  | 'world'
  | 'unknown';

export interface CrashRule {
  id: string;
  category: CrashCategory;
  patterns: string[];
  regex?: string;
  title: string;
  description: string;
  solution: string;
}

export interface CrashDiagnosis {
  id: string;
  category: CrashCategory;
  title: string;
  description: string;
  solution: string;
  matchedLine?: string;
  extractedDetail?: string;
}

const loadedRules: CrashRule[] = (crashRulesData.rules || []) as CrashRule[];

/**
 * 编译并缓存正则表达式，避免循环中重复编译
 */
const compiledRegexCache = new Map<string, RegExp>();
const getCompiledRegex = (pattern: string): RegExp | null => {
  if (!compiledRegexCache.has(pattern)) {
    try {
      compiledRegexCache.set(pattern, new RegExp(pattern, 'i'));
    } catch {
      return null;
    }
  }
  return compiledRegexCache.get(pattern) || null;
};

/**
 * 分析游戏日志并返回结构化诊断报告
 * @param logs 捕获到的所有日志行
 */
export const analyzeCrashLogs = (logs: string[]): CrashDiagnosis => {
  if (!logs || logs.length === 0) {
    return {
      id: 'no_logs',
      category: 'unknown',
      title: '未捕获到进程日志',
      description: '游戏进程在启动前即异常退出，未产生有效标准输出。',
      solution: '请检查游戏路径权限、杀毒软件拦截记录，或在实例设置中重新选择有效的 Java 路径。',
    };
  }

  // 倒序遍历（优先命中最新的致命堆栈与错误信息）
  const maxScanLines = Math.min(logs.length, 1200);
  const startIndex = logs.length - 1;
  const endIndex = logs.length - maxScanLines;

  for (let i = startIndex; i >= endIndex; i--) {
    const line = logs[i];
    if (!line) continue;

    for (const rule of loadedRules) {
      // 1. 快速模式匹配
      const hasPatternMatch = rule.patterns.some((pattern) => line.includes(pattern));

      if (hasPatternMatch) {
        let extractedDetail: string | undefined;

        // 2. 正则提取具体细节（如模组名、Java 类版本号）
        if (rule.regex) {
          const regex = getCompiledRegex(rule.regex);
          if (regex) {
            // 尝试在当前行或前后两行中提取具体捕获组
            const contextLines = [
              logs[i - 1] || '',
              line,
              logs[i + 1] || '',
            ].join('\n');
            const match = contextLines.match(regex);
            if (match) {
              const detail = match.slice(1).find((g) => !!g);
              if (detail) {
                extractedDetail = detail.trim();
              }
            }
          }
        }

        return {
          id: rule.id,
          category: rule.category,
          title: rule.title,
          description: rule.description,
          solution: rule.solution,
          matchedLine: line.length > 240 ? line.slice(0, 240) + '...' : line,
          extractedDetail,
        };
      }
    }
  }

  // 保底未知错误
  return {
    id: 'unknown',
    category: 'unknown',
    title: '未知异常崩溃',
    description: '未能自动匹配到典型的已知崩溃模式，可能是特定模组内部抛出的罕见运行时异常。',
    solution: '建议点击下方「诊断包」打包完整日志，或加入玩家交流群、在社区发帖求助。',
  };
};

/**
 * 格式化诊断报告为方便粘贴的纯文本
 */
export const formatDiagnosisReport = (diag: CrashDiagnosis): string => {
  const parts: string[] = [
    `【Minecraft 崩溃诊断报告】`,
    `问题标题：${diag.title}`,
    `问题类别：${diag.category.toUpperCase()}`,
    `故障说明：${diag.description}`,
  ];

  if (diag.extractedDetail) {
    parts.push(`关联细节：${diag.extractedDetail}`);
  }

  parts.push(`建议操作：${diag.solution}`);

  if (diag.matchedLine) {
    parts.push(`关键堆栈：${diag.matchedLine.trim()}`);
  }

  return parts.join('\n');
};
