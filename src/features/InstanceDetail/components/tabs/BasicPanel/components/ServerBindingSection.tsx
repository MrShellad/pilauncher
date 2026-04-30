import React from 'react';
import { Server, Globe, Save, Pencil, Plus, Unplug } from 'lucide-react';

import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreSwitch } from '../../../../../../ui/primitives/OreSwitch';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';
import { useServerBindingSection } from '../hooks/useServerBindingSection';
import {
  formatServerAddress,
  getServerPreviewName,
} from '../utils/serverBindingSectionUtils';
import type { ServerBindingSectionProps } from '../schemas/basicPanelSchemas';

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
  const {
    isEditingServer,
    editServer,
    canSaveServer,
    startAddServer,
    startEditServer,
    cancelEditServer,
    setEditServerName,
    setEditServerIp,
    setEditServerPort,
    handleSaveServer,
    handleUnbindServer,
    handleAutoJoinChange,
  } = useServerBindingSection({
    serverBinding,
    onUpdateServerBinding,
    onUpdateAutoJoinServer,
    onSuccess,
    setIsGlobalSaving,
  });

  return (
    <SettingsSection title="实例服务器" icon={<Server size="1.125rem" />}>
      {serverBinding || isEditingServer ? (
        <>
          <FormRow
            label="绑定服务器"
            description={
              <>
                <span>{isEditingServer ? '修改服务器信息后点击保存即可生效。' : '当前实例已绑定到以下服务器，启动游戏时可自动连接。'}</span>
                <div className="flex items-center gap-3 px-4 py-3 bg-[#141415] border-2 border-[#2A2A2C] rounded-sm mt-3 max-w-[20rem]">
                  <div className="w-10 h-10 rounded-sm bg-[#1E1E1F] border-2 border-[#2A2A2C] flex items-center justify-center flex-shrink-0">
                    <Globe size="1.25rem" className="text-emerald-400" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-white font-minecraft text-sm font-bold truncate ore-text-shadow">
                      {isEditingServer
                        ? getServerPreviewName(editServer)
                        : serverBinding!.name}
                    </span>
                    <span className="text-ore-text-muted font-minecraft text-xs">
                      {isEditingServer
                        ? formatServerAddress(editServer.ip.trim(), editServer.port)
                        : formatServerAddress(serverBinding!.ip, serverBinding!.port)}
                    </span>
                  </div>
                </div>
              </>
            }
            control={
              isEditingServer ? (
                <div className="flex flex-col gap-3 w-full min-w-[17.5rem] max-w-[22.5rem]">
                  <OreInput
                    focusKey="basic-input-server-name"
                    value={editServer.name}
                    onChange={(e) => setEditServerName(e.target.value)}
                    disabled={isGlobalSaving || isInitializing}
                    placeholder="服务器名称"
                  />
                  <div className="flex items-center gap-2">
                    <OreInput
                      focusKey="basic-input-server-ip"
                      value={editServer.ip}
                      onChange={(e) => setEditServerIp(e.target.value)}
                      disabled={isGlobalSaving || isInitializing}
                      placeholder="服务器地址 (IP 或域名)"
                      containerClassName="flex-[3]"
                    />
                    <OreInput
                      focusKey="basic-input-server-port"
                      value={editServer.port}
                      onChange={(e) => setEditServerPort(e.target.value)}
                      disabled={isGlobalSaving || isInitializing}
                      placeholder="端口"
                      containerClassName="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <OreButton
                      focusKey="basic-btn-save-server"
                      variant="primary"
                      onClick={handleSaveServer}
                      disabled={isGlobalSaving || isInitializing || !canSaveServer}
                    >
                      <Save size="1rem" className="mr-1.5" /> 保存
                    </OreButton>
                    <OreButton
                      focusKey="basic-btn-cancel-edit-server"
                      variant="secondary"
                      onClick={cancelEditServer}
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
                    onClick={startEditServer}
                    disabled={isGlobalSaving || isInitializing}
                  >
                    <Pencil size="1rem" className="mr-1.5" /> 编辑
                  </OreButton>
                  <OreButton
                    focusKey="basic-btn-unbind-server"
                    variant="danger"
                    onClick={handleUnbindServer}
                    disabled={isGlobalSaving || isInitializing}
                  >
                    <Unplug size="1rem" className="mr-1.5" /> 解除绑定
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
                  onChange={handleAutoJoinChange}
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
              onClick={startAddServer}
              disabled={isGlobalSaving || isInitializing}
            >
              <Plus size="1rem" className="mr-1.5" /> 添加服务器
            </OreButton>
          }
        />
      )}
    </SettingsSection>
  );
};
