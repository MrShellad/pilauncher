import React, { useState } from 'react';
import { Server, Globe, Save, Pencil, Plus, Unplug } from 'lucide-react';

import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreSwitch } from '../../../../../../ui/primitives/OreSwitch';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';

import type { ServerBindingInfo } from '../../../../../../hooks/pages/InstanceDetail/useInstanceDetail';

interface ServerBindingSectionProps {
  serverBinding?: ServerBindingInfo | null;
  autoJoinServer?: boolean;
  isInitializing: boolean;
  onUpdateServerBinding: (binding: ServerBindingInfo | null) => Promise<void>;
  onUpdateAutoJoinServer: (autoJoin: boolean) => Promise<void>;
  onSuccess: (msg: string) => void;
  isGlobalSaving: boolean;
  setIsGlobalSaving: (val: boolean) => void;
}

export const ServerBindingSection: React.FC<ServerBindingSectionProps> = ({
  serverBinding,
  autoJoinServer,
  isInitializing,
  onUpdateServerBinding,
  onUpdateAutoJoinServer,
  onSuccess,
  isGlobalSaving,
  setIsGlobalSaving,
}) => {
  const [isEditingServer, setIsEditingServer] = useState(false);
  const [editServerName, setEditServerName] = useState('');
  const [editServerIp, setEditServerIp] = useState('');
  const [editServerPort, setEditServerPort] = useState('');

  return (
    <SettingsSection title="实例服务器" icon={<Server size={18} />}>
      {serverBinding || isEditingServer ? (
        <>
          <FormRow
            label="绑定服务器"
            description={
              <>
                <span>{isEditingServer ? '修改服务器信息后点击保存即可生效。' : '当前实例已绑定到以下服务器，启动游戏时可自动连接。'}</span>
                <div className="flex items-center gap-3 px-4 py-3 bg-[#141415] border-2 border-[#2A2A2C] rounded-sm mt-3 max-w-[320px]">
                  <div className="w-10 h-10 rounded-sm bg-[#1E1E1F] border-2 border-[#2A2A2C] flex items-center justify-center flex-shrink-0">
                    <Globe size={20} className="text-emerald-400" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-white font-minecraft text-sm font-bold truncate ore-text-shadow">
                      {isEditingServer
                        ? (editServerName.trim() || editServerIp.trim() || '未命名服务器')
                        : serverBinding!.name}
                    </span>
                    <span className="text-ore-text-muted font-minecraft text-xs">
                      {isEditingServer
                        ? `${editServerIp.trim() || '...'}${editServerPort && editServerPort !== '25565' ? `:${editServerPort}` : ''}`
                        : `${serverBinding!.ip}${serverBinding!.port !== 25565 ? `:${serverBinding!.port}` : ''}`}
                    </span>
                  </div>
                </div>
              </>
            }
            control={
              isEditingServer ? (
                <div className="flex flex-col gap-3 w-full min-w-[280px] max-w-[360px]">
                  <OreInput
                    focusKey="basic-input-server-name"
                    value={editServerName}
                    onChange={(e) => setEditServerName(e.target.value)}
                    disabled={isGlobalSaving || isInitializing}
                    placeholder="服务器名称"
                  />
                  <div className="flex items-center gap-2">
                    <OreInput
                      focusKey="basic-input-server-ip"
                      value={editServerIp}
                      onChange={(e) => setEditServerIp(e.target.value)}
                      disabled={isGlobalSaving || isInitializing}
                      placeholder="服务器地址 (IP 或域名)"
                      containerClassName="flex-[3]"
                    />
                    <OreInput
                      focusKey="basic-input-server-port"
                      value={editServerPort}
                      onChange={(e) => setEditServerPort(e.target.value.replace(/[^0-9]/g, ''))}
                      disabled={isGlobalSaving || isInitializing}
                      placeholder="端口"
                      containerClassName="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <OreButton
                      focusKey="basic-btn-save-server"
                      variant="primary"
                      onClick={async () => {
                        if (!editServerIp.trim()) return;
                        setIsGlobalSaving(true);
                        await onUpdateServerBinding({
                          uuid: serverBinding?.uuid || '',
                          name: editServerName.trim() || editServerIp.trim(),
                          ip: editServerIp.trim(),
                          port: parseInt(editServerPort, 10) || 25565,
                        });
                        setIsGlobalSaving(false);
                        setIsEditingServer(false);
                        onSuccess('服务器信息已保存');
                      }}
                      disabled={isGlobalSaving || isInitializing || !editServerIp.trim()}
                    >
                      <Save size={16} className="mr-1.5" /> 保存
                    </OreButton>
                    <OreButton
                      focusKey="basic-btn-cancel-edit-server"
                      variant="secondary"
                      onClick={() => setIsEditingServer(false)}
                      disabled={isGlobalSaving}
                    >
                      取消
                    </OreButton>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <OreButton
                    focusKey="basic-btn-edit-server"
                    variant="secondary"
                    onClick={() => {
                      setEditServerName(serverBinding!.name);
                      setEditServerIp(serverBinding!.ip);
                      setEditServerPort(String(serverBinding!.port));
                      setIsEditingServer(true);
                    }}
                    disabled={isGlobalSaving || isInitializing}
                  >
                    <Pencil size={16} className="mr-1.5" /> 编辑
                  </OreButton>
                  <OreButton
                    focusKey="basic-btn-unbind-server"
                    variant="danger"
                    onClick={async () => {
                      setIsGlobalSaving(true);
                      await onUpdateServerBinding(null);
                      setIsGlobalSaving(false);
                      setIsEditingServer(false);
                      onSuccess('已解除服务器绑定');
                    }}
                    disabled={isGlobalSaving || isInitializing}
                  >
                    <Unplug size={16} className="mr-1.5" /> 解除绑定
                  </OreButton>
                </div>
              )
            }
          />

          {!isEditingServer && (
            <FormRow
              label="启动时自动进入服务器"
              description="开启后，启动游戏将自动连接到绑定的服务器，无需手动选择。"
              control={
                <OreSwitch
                  focusKey="basic-switch-auto-join"
                  checked={autoJoinServer ?? true}
                  onChange={async (checked) => {
                    setIsGlobalSaving(true);
                    await onUpdateAutoJoinServer(checked);
                    setIsGlobalSaving(false);
                    onSuccess(checked ? '已开启自动进入服务器' : '已关闭自动进入服务器');
                  }}
                  disabled={isGlobalSaving || isInitializing}
                />
              }
            />
          )}
        </>
      ) : (
        <FormRow
          label="绑定服务器"
          description="当前实例未绑定任何服务器。你可以手动添加或在多人游戏页面中绑定。"
          control={
            <OreButton
              focusKey="basic-btn-add-server"
              variant="secondary"
              onClick={() => {
                setEditServerName('');
                setEditServerIp('');
                setEditServerPort('25565');
                setIsEditingServer(true);
              }}
              disabled={isGlobalSaving || isInitializing}
            >
              <Plus size={16} className="mr-1.5" /> 添加服务器
            </OreButton>
          }
        />
      )}
    </SettingsSection>
  );
};
