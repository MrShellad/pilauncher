// src/ui/components/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { OreButton } from '../primitives/OreButton';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught component error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    this.props.onReset?.();
  };

  private handleCopy = () => {
    const errorDetails = [
      this.state.error?.name,
      this.state.error?.message,
      this.state.error?.stack,
      this.state.errorInfo?.componentStack
    ].filter(Boolean).join('\n\n');

    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(() => {});
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center font-minecraft select-none bg-[#1A1A1C]">
          <div className="flex max-w-lg flex-col items-center border-[2px] border-[#1E1E1F] bg-[#242426] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-2px_rgba(0,0,0,0.5)]">
            <div className="mb-3 flex h-12 w-12 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#361A1A] text-[#EF4444]">
              <AlertTriangle size={24} />
            </div>

            <h3 className="mb-2 text-base font-bold text-white ore-text-shadow">
              {this.props.fallbackTitle || '组件加载出现异常'}
            </h3>

            <p className="mb-4 text-xs text-[#A0A2A6] leading-relaxed">
              {this.state.error?.message || '渲染过程中发生了意外错误，请尝试重新加载此组件。'}
            </p>

            {this.state.error && (
              <details className="mb-4 w-full text-left">
                <summary className="cursor-pointer text-[11px] text-[#7AA2FF] hover:underline focus:outline-none">
                  查看详细错误堆栈
                </summary>
                <pre className="mt-2 max-h-36 overflow-auto border border-[#1E1E1F] bg-[#141416] p-2 text-[10px] text-[#EF4444] font-mono whitespace-pre-wrap select-text">
                  {this.state.error.stack || this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex items-center gap-3">
              <OreButton
                variant="primary"
                size="sm"
                onClick={this.handleReset}
                className="gap-1.5"
              >
                <RefreshCw size={13} />
                重新尝试
              </OreButton>

              <OreButton
                variant="secondary"
                size="sm"
                onClick={this.handleCopy}
                className="gap-1.5"
              >
                {this.state.copied ? <Check size={13} className="text-ore-green" /> : <Copy size={13} />}
                {this.state.copied ? '已复制' : '复制错误'}
              </OreButton>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
