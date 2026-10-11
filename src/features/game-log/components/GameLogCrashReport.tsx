import React from 'react';
import { AlertTriangle, Check, Copy, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '../../../ui/primitives/OreButton';
import type { CrashDiagnosis } from '../logic/crashAnalyzer';

interface GameLogCrashReportProps {
  diagnosis: CrashDiagnosis | null;
  reason: string | null;
  copied: boolean;
  onCopy: () => void;
}

export const GameLogCrashReport: React.FC<GameLogCrashReportProps> = ({
  diagnosis,
  reason,
  copied,
  onCopy
}) => {
  const { t } = useTranslation();

  return (
    <div className="shrink-0 bg-gradient-to-r from-red-950/70 via-red-950/45 to-[#141415] border-b border-red-900/60 p-4 relative z-10 select-text">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-sm bg-red-900/40 border border-red-700/50 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-red-300 font-bold text-sm tracking-wide">
                {diagnosis ? diagnosis.title : t('gameLog.sidebar.autoDiag', '自动诊断报告')}
              </h4>
              {diagnosis?.category && (
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-xs bg-red-900/60 text-red-200 border border-red-700/50">
                  {diagnosis.category}
                </span>
              )}
              {diagnosis?.extractedDetail && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs bg-amber-500/15 text-amber-200 border border-amber-500/30 truncate max-w-[320px]">
                  {diagnosis.extractedDetail}
                </span>
              )}
            </div>

            <p className="text-xs text-red-200/90 leading-relaxed break-words">
              {diagnosis ? diagnosis.description : reason}
            </p>

            {diagnosis?.solution && (
              <div className="mt-2 flex items-start gap-2 p-2.5 rounded-sm bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs leading-relaxed">
                <Lightbulb size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-300 mr-1.5">建议排查方案:</span>
                  <span>{diagnosis.solution}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <OreButton
          focusKey="log-btn-copy-diag"
          variant={copied ? 'primary' : 'secondary'}
          size="sm"
          onClick={onCopy}
          className="shrink-0 text-xs mt-0.5 min-w-[96px] justify-center transition-all"
        >
          {copied ? <Check size={13} className="mr-1 shrink-0" /> : <Copy size={13} className="mr-1 shrink-0" />}
          <span>{copied ? t('gameLog.sidebar.diagCopied', '已复制') : t('gameLog.sidebar.copyDiag', '复制诊断')}</span>
        </OreButton>
      </div>
    </div>
  );
};
