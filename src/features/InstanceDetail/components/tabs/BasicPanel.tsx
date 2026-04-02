// /src/features/InstanceDetail/components/tabs/BasicPanel.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Trash2,
  ShieldCheck,
  Save,
  Loader2,
  CheckCircle2,
  Plus,
  X,
  FileText,
  Link2,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { BUTTON_TYPES, getButtonIcon } from '../../../../ui/icons/SocialIcons';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { listen } from '@tauri-apps/api/event';

import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';

import type {
  InstanceDetailData,
  CustomButton,
  MissingRuntime,
  VerifyInstanceRuntimeResult
} from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';

interface BasicPanelProps {
  data: InstanceDetailData;
  isInitializing: boolean;
  onUpdateName: (newName: string) => Promise<void>;
  onUpdateCover: () => Promise<void>;
  onUpdateCustomButtons: (buttons: CustomButton[]) => Promise<void>;
  onVerifyFiles: () => Promise<VerifyInstanceRuntimeResult>;
  onRepairFiles: (repair: MissingRuntime) => Promise<void>;
  onDelete: (skipConfirm?: boolean) => Promise<void>;
}

interface VerifyProgressEventPayload {
  instance_id: string;
  stage: string;
  current: number;
  total: number;
  message?: string;
}

type VerifyDialogState =
  | 'idle'
  | 'verifying'
  | 'repair'
  | 'repairing'
  | 'clean'
  | 'queued'
  | 'error';

export const BasicPanel: React.FC<BasicPanelProps> = ({
  data,
  isInitializing,
  onUpdateName,
  onUpdateCover,
  onUpdateCustomButtons,
  onVerifyFiles,
  onRepairFiles,
  onDelete,
}) => {
  const [editName, setEditName] = useState(data.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customButtons, setCustomButtons] = useState<CustomButton[]>(data.customButtons || []);
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyDialogState>('idle');
  const [verifyProgress, setVerifyProgress] = useState({ current: 0, total: 1, message: '' });
  const [verifyResult, setVerifyResult] = useState<VerifyInstanceRuntimeResult | null>(null);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    setEditName(data.name);
    setCustomButtons(data.customButtons || []);
  }, [data.name, data.customButtons]);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const handleSaveName = async () => {
    if (editName !== data.name && editName.trim() !== '') {
      setIsSaving(true);
      await onUpdateName(editName);
      setIsSaving(false);
      triggerSuccess('名称已保存');
    } else {
      setEditName(data.name || '');
    }
  };

  const handleChangeCover = async () => {
    setIsSaving(true);
    await onUpdateCover();
    setIsSaving(false);
  };

  const handleSaveCustomButtons = async () => {
    setIsSaving(true);
    await onUpdateCustomButtons(customButtons);
    setIsSaving(false);
    triggerSuccess('自定义链接已保存');
  };

  const handleAddButton = () => {
    setCustomButtons([...customButtons, { type: 'wiki', url: '', label: '' }]);
  };

  const handleRemoveButton = (index: number) => {
    setCustomButtons(customButtons.filter((_, i) => i !== index));
  };

  const handleChangeButton = (index: number, field: keyof CustomButton, value: string) => {
    const newBtns = [...customButtons];
    newBtns[index] = { ...newBtns[index], [field]: value };
    setCustomButtons(newBtns);
  };

  const handleDelete = () => setIsDeleteModalOpen(true);

  const confirmDelete = async () => {
    setIsSaving(true);
    setIsDeleteModalOpen(false);
    await onDelete(true);
  };

  const resetVerifyDialog = () => {
    setVerifyState('idle');
    setVerifyProgress({ current: 0, total: 1, message: '' });
    setVerifyResult(null);
    setVerifyError('');
  };

  const canCloseVerifyDialog = verifyState !== 'verifying' && verifyState !== 'repairing';

  const handleCloseVerifyDialog = () => {
    if (!canCloseVerifyDialog) return;
    setIsVerifyDialogOpen(false);
    resetVerifyDialog();
  };

  const handleStartVerify = async () => {
    if (verifyState === 'verifying' || verifyState === 'repairing') return;

    setIsVerifyDialogOpen(true);
    setVerifyState('verifying');
    setVerifyResult(null);
    setVerifyError('');
    setVerifyProgress({ current: 0, total: 1, message: '正在准备校验...' });

    let unlisten: (() => void) | null = null;

    try {
      unlisten = await listen<VerifyProgressEventPayload>('instance-runtime-verify-progress', (event) => {
        const payload = event.payload;
        if (payload.instance_id !== data.id) return;

        setVerifyProgress({
          current: payload.current ?? 0,
          total: Math.max(payload.total ?? 1, 1),
          message: payload.message || '正在校验文件...',
        });
      });

      const result = await onVerifyFiles();
      setVerifyResult(result);
      setVerifyState(result.needs_repair ? 'repair' : 'clean');
    } catch (error) {
      setVerifyError(error instanceof Error ? error.message : String(error));
      setVerifyState('error');
    } finally {
      if (unlisten) unlisten();
    }
  };

  const handleConfirmVerifyDialog = async () => {
    if (verifyState === 'repair') {
      if (!verifyResult?.repair) {
        setVerifyError('校验结果缺少补全参数，无法继续。');
        setVerifyState('error');
        return;
      }

      try {
        setVerifyState('repairing');
        await onRepairFiles(verifyResult.repair);
        setVerifyState('queued');
      } catch (error) {
        setVerifyError(error instanceof Error ? error.message : String(error));
        setVerifyState('error');
      }
      return;
    }

    if (verifyState === 'clean' || verifyState === 'queued' || verifyState === 'error') {
      handleCloseVerifyDialog();
    }
  };

  const verifyBusy = verifyState === 'verifying' || verifyState === 'repairing';
  const verifyPercent = Math.max(
    0,
    Math.min(100, Math.round((verifyProgress.current / Math.max(verifyProgress.total, 1)) * 100))
  );
  const verifyIssues = verifyResult?.issues ?? [];

  const verifyDialogTone =
    verifyState === 'repair' || verifyState === 'repairing'
      ? 'warning'
      : verifyState === 'error'
        ? 'danger'
        : 'info';

  const verifyDialogTitle =
    verifyState === 'repair'
      ? '校验发现异常'
      : verifyState === 'repairing'
        ? '正在补全文件'
        : verifyState === 'clean'
          ? '校验完成'
          : verifyState === 'queued'
            ? '已加入下载队列'
            : verifyState === 'error'
              ? '校验失败'
              : '正在校验文件';

  const verifyDialogHeadline =
    verifyState === 'repair'
      ? '检测到文件缺失或哈希不一致。'
      : verifyState === 'repairing'
        ? '正在调用下载管理补全运行时文件。'
        : verifyState === 'clean'
          ? '当前实例运行时文件完整。'
          : verifyState === 'queued'
            ? '补全任务已加入下载管理。'
            : verifyState === 'error'
              ? '校验过程出现错误。'
              : '请稍候，正在逐项校验。';

  const verifyDialogDescription =
    verifyState === 'repair'
      ? '确认后将自动打开下载管理并开始补全。'
      : verifyState === 'queued'
        ? '你可以在下载管理中查看实时进度。'
        : verifyState === 'error'
          ? verifyError || '未知错误'
          : verifyState === 'clean'
            ? '未发现需要补全的运行时文件。'
            : verifyProgress.message || '正在校验运行时...';

  const verifyConfirmLabel =
    verifyState === 'repair'
      ? '开始补全'
      : verifyState === 'repairing'
        ? '补全中'
        : verifyState === 'verifying'
          ? '校验中'
          : '关闭';

  const verifySingleClose = verifyState === 'clean';
  const verifyHeadlineNode = (
    <span className="block min-h-[1.75rem] leading-6">
      {verifyDialogHeadline}
    </span>
  );
  const verifyDescriptionNode = (
    <span className="block min-h-[2.5rem] leading-5 text-ore-text-muted">
      {verifyDialogDescription}
    </span>
  );

  const isNameChanged = editName !== data.name && editName.trim() !== '';

  const dropdownOptions = useMemo(() => {
    return BUTTON_TYPES.map(t => ({ label: t.label, value: t.value }));
  }, []);

  return (
    <SettingsPageLayout>
      <div className="relative flex flex-col w-full h-full gap-[clamp(1.5rem,2vw,2rem)]">

        <FocusItem focusKey="basic-guard-top" onFocus={() => setFocus('basic-input-name')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 left-0 w-full h-[1px] opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="basic-guard-left" onFocus={() => setFocus('basic-input-name')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 left-0 w-[1px] h-full opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="basic-guard-right" onFocus={() => setFocus('basic-btn-change-cover')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 right-0 w-[1px] h-full opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="basic-guard-bottom" onFocus={() => setFocus('basic-btn-delete-instance')}>
          {({ ref }) => <div ref={ref as any} className="absolute bottom-0 left-0 w-full h-[1px] opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>

        <div className="flex justify-end h-6 mb-2 pr-6 font-minecraft transition-opacity duration-300">
          {isSaving && (
            <span className="text-ore-text-muted text-sm flex items-center">
              <Loader2 size={14} className="animate-spin mr-1.5" /> 正在保存...
            </span>
          )}
          {successMsg && !isSaving && (
            <span className="text-ore-green text-sm flex items-center drop-shadow-[0_0_5px_rgba(56,133,39,0.5)]">
              <CheckCircle2 size={14} className="mr-1.5" /> {successMsg}
            </span>
          )}
        </div>

        {/* ==================== 1. 基本信息 ==================== */}
        <SettingsSection title="基本信息" icon={<FileText size={18} />}>
          <FormRow
            label="实例名称"
            description="用于在列表中显示的自定义名称。"
            className="!lg:items-center"
            control={
              <div className="flex items-center gap-3 w-full lg:w-[480px]">
                <OreInput
                  focusKey="basic-input-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  disabled={isSaving || isInitializing}
                  placeholder="输入实例名称"
                  containerClassName="flex-1"
                />
                <OreButton
                  focusKey="basic-btn-save-name"
                  variant={isNameChanged ? 'primary' : 'secondary'}
                  onClick={handleSaveName}
                  disabled={!isNameChanged || isSaving || isInitializing}
                  className="flex-shrink-0"
                >
                  <Save size={16} className="mr-2" /> 保存
                </OreButton>
              </div>
            }
          />

          <FormRow
            label="实例封面"
            description="支持 .png 或 .jpg 格式，建议比例 16:9。"
            control={
              <div className="flex items-center gap-4">
                <div className="w-32 h-18 bg-[#141415] border-2 border-[#1E1E1F] rounded-sm flex items-center justify-center overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] relative">
                  {data.coverUrl ? (
                    <img src={data.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={24} className="text-ore-text-muted opacity-60" />
                  )}
                  {isSaving && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
                <OreButton
                  focusKey="basic-btn-change-cover"
                  variant="secondary"
                  onClick={handleChangeCover}
                  disabled={isSaving || isInitializing}
                >
                  更换封面
                </OreButton>
              </div>
            }
          />
        </SettingsSection>

        {/* ==================== 2. 自定义链接管理 ==================== */}
        <SettingsSection title="自定义链接管理" icon={<Link2 size={18} />}>
          <FormRow
            label="快速链接"
            description="为整合包添加快速链接按钮（如 Wiki、社区、官网等），将展示在主页和概览页。留空标题时将使用平台名称。"
            vertical
            control={
              <div className="w-full space-y-3">
                {customButtons.map((btn, idx) => {
                  const IconComp = getButtonIcon(btn.type);
                  return (
                    <div
                      key={idx}
                      className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 p-3 bg-[#18181B] border-2 border-[#2A2A2C] rounded-sm transition-colors hover:border-[#3A3A3C]"
                    >
                      {/* 平台类型下拉 */}
                      <div className="w-full lg:w-[160px] flex-shrink-0">
                        <OreDropdown
                          focusKey={`btn-type-select-${idx}`}
                          options={dropdownOptions}
                          value={btn.type}
                          onChange={(val) => handleChangeButton(idx, 'type', val)}
                          disabled={isSaving || isInitializing}
                          prefixNode={<IconComp size={18} />}
                          className="w-full"
                        />
                      </div>

                      {/* 自定义标题 */}
                      <div className="w-full lg:w-[140px] flex-shrink-0">
                        <OreInput
                          focusKey={`btn-label-${idx}`}
                          value={btn.label || ''}
                          onChange={(e) => handleChangeButton(idx, 'label', e.target.value)}
                          disabled={isSaving || isInitializing}
                          placeholder="自定义标题"
                        />
                      </div>

                      {/* URL 输入 */}
                      <div className="flex-1 w-full min-w-0">
                        <OreInput
                          focusKey={`btn-url-${idx}`}
                          value={btn.url}
                          onChange={(e) => handleChangeButton(idx, 'url', e.target.value)}
                          disabled={isSaving || isInitializing}
                          placeholder="https://..."
                        />
                      </div>

                      {/* 删除按钮 */}
                      <FocusItem focusKey={`btn-remove-${idx}`}>
                        {({ ref, focused }) => (
                          <button
                            ref={ref as any}
                            onClick={() => handleRemoveButton(idx)}
                            disabled={isSaving || isInitializing}
                            className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-sm outline-none transition-all ${
                              focused
                                ? 'bg-red-500/20 text-red-400 ring-2 ring-red-400'
                                : 'text-ore-text-muted hover:text-white hover:bg-[#2A2A2C]'
                            } disabled:opacity-40`}
                            title="删除链接"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </FocusItem>
                    </div>
                  );
                })}

                {customButtons.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-[#1E1E1F] rounded-sm bg-[#141415]/20">
                    <Link2 size={24} className="text-ore-text-muted opacity-40 mb-2" />
                    <span className="text-sm text-ore-text-muted font-minecraft">暂无自定义链接，点击下方添加</span>
                  </div>
                )}
              </div>
            }
          />

          {/* 操作按钮行 */}
          <FormRow
            label="管理链接"
            control={
              <div className="flex items-center gap-3">
                <OreButton
                  focusKey="btn-add-link"
                  variant="secondary"
                  onClick={handleAddButton}
                  disabled={isSaving || isInitializing}
                >
                  <Plus size={16} className="mr-1.5" /> 添加链接
                </OreButton>
                <OreButton
                  focusKey="btn-save-links"
                  variant="primary"
                  onClick={handleSaveCustomButtons}
                  disabled={isSaving || isInitializing || customButtons.length === 0}
                >
                  <Save size={16} className="mr-1.5" /> 保存配置
                </OreButton>
              </div>
            }
          />
        </SettingsSection>

        {/* ==================== 3. 实例维护 ==================== */}
        <SettingsSection title="实例维护" icon={<Wrench size={18} />}>
          <FormRow
            label="补全缺失文件"
            description="自动检查并重新下载缺失的核心文件、运行库或依赖资源。"
            control={
              <OreButton
                focusKey="basic-btn-verify-files"
                variant="secondary"
                onClick={handleStartVerify}
                disabled={isSaving || isInitializing || verifyBusy}
                className="w-40"
              >
                <ShieldCheck size={16} className="mr-2" /> 校验补全
              </OreButton>
            }
          />
        </SettingsSection>

        {/* ==================== 4. 危险区域 ==================== */}
        <SettingsSection title="危险区域" icon={<AlertTriangle size={18} />} danger>
          <FormRow
            label="彻底删除实例"
            description="此操作不可逆，将永久删除该实例的所有本地文件与存档。"
            control={
              <OreButton
                focusKey="basic-btn-delete-instance"
                variant="danger"
                onClick={handleDelete}
                disabled={isSaving || isInitializing}
                className="w-40"
              >
                <Trash2 size={16} className="mr-2" /> 彻底删除
              </OreButton>
            }
          />
        </SettingsSection>

        {/* 彻底删除弹窗 */}
        <OreConfirmDialog
          isOpen={isVerifyDialogOpen}
          onClose={handleCloseVerifyDialog}
          onConfirm={() => {
            void handleConfirmVerifyDialog();
          }}
          title={verifyDialogTitle}
          headline={verifyHeadlineNode}
          description={verifyDescriptionNode}
          confirmLabel={verifyConfirmLabel}
          hideCancelButton={verifySingleClose}
          cancelLabel={verifyState === 'repair' ? '暂不补全' : '关闭'}
          confirmVariant={verifyState === 'repair' ? 'primary' : 'secondary'}
          tone={verifyDialogTone}
          confirmFocusKey="basic-verify-confirm"
          cancelFocusKey="basic-verify-cancel"
          bodyClassName="flex h-full flex-col items-center justify-start text-center"
          modalContentClassName="!p-5 overflow-hidden"
          confirmIcon={
            verifyState === 'repair'
              ? <Wrench size={16} className="mr-2" />
              : <ShieldCheck size={16} className="mr-2" />
          }
          dialogIcon={
            verifyState === 'clean' || verifyState === 'queued'
              ? <CheckCircle2 size={32} className="text-ore-green" />
              : verifyState === 'error'
                ? <AlertTriangle size={32} className="text-red-500" />
                : <ShieldCheck size={32} className={verifyState === 'verifying' ? 'text-sky-400 animate-pulse' : 'text-sky-400'} />
          }
          isConfirming={verifyState === 'verifying' || verifyState === 'repairing'}
          closeOnOutsideClick={canCloseVerifyDialog}
          className="w-[560px] h-[440px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]"
        >
          {(verifyState === 'verifying' || verifyState === 'repairing') && (
            <div className="mt-4 w-full max-h-[172px] space-y-3 overflow-y-auto px-2 custom-scrollbar">
              <div className="overflow-hidden rounded-full border-2 border-[#2A2A2C] bg-[#141415] shadow-inner">
                <div
                  className="h-3 bg-[#3C8527] transition-[width] duration-200"
                  style={{ width: `${verifyPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-[#A1A3A5]">
                <span>{verifyProgress.message || '正在校验文件...'}</span>
                <span className="text-ore-green">{verifyPercent}%</span>
              </div>
            </div>
          )}

          {verifyState === 'repair' && verifyIssues.length > 0 && (
            <div className="mt-4 w-full max-h-[172px] overflow-y-auto rounded-sm border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-left text-sm text-yellow-100 custom-scrollbar">
              {verifyIssues.map((issue, index) => (
                <div key={`${issue}-${index}`} className={index > 0 ? 'mt-2' : ''}>
                  {issue}
                </div>
              ))}
            </div>
          )}
        </OreConfirmDialog>

        <OreConfirmDialog
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          title="警告：彻底删除实例"
          headline={
            <>
              您确定要彻底删除实例 <span className="font-bold text-red-400">"{data.name}"</span> 吗？
            </>
          }
          description="此操作无法撤销，与该实例相关的所有配置、模组以及游戏存档都会被永久清除。"
          confirmLabel="强制删除"
          cancelLabel="取消"
          confirmVariant="danger"
          confirmFocusKey="basic-modal-btn-confirm"
          cancelFocusKey="basic-modal-btn-cancel"
          confirmIcon={<Trash2 size={16} className="mr-2" />}
          dialogIcon={<Trash2 size={32} className="text-red-500" />}
          isConfirming={isSaving}
        />

      </div>
    </SettingsPageLayout>
  );
};
