import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useAccountStore } from '@/features/account';
import { useSettingsStore } from '@/app/stores/useSettingsStore';
import { resolveAccountAvatarAsset } from '../../../services/accountAppearance';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { useInputAction } from '../../../ui/focus/InputDriver';
import defaultAvatar from '../../../assets/home/account/128.png';
import { JavaFriendsAndLanPanel } from './account-slider-bar/JavaFriendsAndLanPanel';
import { LanTransferDialogs } from './account-slider-bar/LanTransferDialogs';
import { LanTransferPanel } from './account-slider-bar/LanTransferPanel';
import { TrustedDevicesList } from './account-slider-bar/TrustedDevicesList';
import { UserProfileCard } from './account-slider-bar/UserProfileCard';
import { useLanTransferController } from './account-slider-bar/useLanTransferController';

interface MicrosoftAccountSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MicrosoftAccountSidebar: React.FC<MicrosoftAccountSidebarProps> = ({
  isOpen,
  onClose,
}) => {
  const { accounts, activeAccountId, setActiveAccount } = useAccountStore();
  const { settings } = useSettingsStore();
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const currentAccount = accounts.find((item) => item.uuid === activeAccountId);
  const isPremium = currentAccount?.type?.toLowerCase() === 'microsoft';
  const hasPremiumAnywhere = accounts.some((item) => item.type?.toLowerCase() === 'microsoft');
  const lastFocusRef = useRef<string | null>(null);

  const {
    transferTarget,
    setTransferTarget,
    transferType,
    setTransferType,
    instances,
    saves,
    selectedInstance,
    setSelectedInstance,
    selectedSave,
    setSelectedSave,
    isPushing,
    transferHistory,
    progressMap,
    incomingData,
    receiveTargetInstance,
    setReceiveTargetInstance,
    isApplying,
    isRejecting,
    focusedDeviceId,
    setFocusedDeviceId,
    deviceToRemove,
    setDeviceToRemove,
    timelineRef,
    discovered,
    trusted,
    friends,
    isScanning,
    isRequesting,
    incomingRequest,
    resolveTrustRequest,
    scan,
    sendTrustRequest,
    trustDevice,
    removeTrustedDevice,
    onlineDeviceMap,
    selectedTargetOnline,
    selectedFriend,
    activeProgress,
    handleSelectTrustedDevice,
    executePush,
    executeApply,
    rejectIncoming,
  } = useLanTransferController({
    isOpen,
    currentAccount,
    isPremium,
    deviceId: settings.general.deviceId,
    deviceName: settings.general.deviceName,
  });

  const handleCycleAccount = () => {
    if (accounts.length <= 1) {
      return;
    }
    const currentIndex = accounts.findIndex((item) => item.uuid === activeAccountId);
    const nextIndex = (currentIndex + 1) % accounts.length;
    setActiveAccount(accounts[nextIndex].uuid);
  };

  const handleClose = () => {
    onClose();
    const last = lastFocusRef.current;
    const fallback = 'btn-profile';
    const target =
      last && doesFocusableExist(last) ? last : doesFocusableExist(fallback) ? fallback : null;
    if (target) {
      window.setTimeout(() => setFocus(target), 80);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const current = getCurrentFocusKey();
      if (current && current !== 'SN:ROOT') {
        lastFocusRef.current = current;
      }
    }
  }, [isOpen]);

  useInputAction('CANCEL', () => {
    if (isOpen) {
      handleClose();
    }
  });

  useEffect(() => {
    if (!currentAccount) {
      return;
    }

    const fetchAvatar = async () => {
      const avatar = await resolveAccountAvatarAsset(currentAccount);
      setAvatarSrc(avatar || defaultAvatar);
    };

    void fetchAvatar();
  }, [currentAccount]);

  if (!currentAccount) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <FocusBoundary
            id="account-sidebar-boundary"
            trapFocus={isOpen}
            onEscape={handleClose}
            className="fixed inset-0 z-[100] flex outline-none"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ore-ms-sidebar-overlay absolute inset-0 cursor-pointer"
              onClick={handleClose}
            />

            <motion.div
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onAnimationComplete={() => setFocus('account-sidebar-boundary')}
              className="ore-ms-sidebar-shell absolute left-0 top-0 bottom-0 flex w-full flex-col md:w-[85vw] lg:w-[75vw] xl:w-[1000px]"
            >
              <div className="custom-scrollbar ore-ms-sidebar-scroll flex h-full flex-col overflow-y-auto p-6">
                <div className="mb-6 flex flex-1 flex-col gap-6 sm:flex-row">
                  <div className="flex w-full flex-shrink-0 flex-col gap-6 sm:w-[320px]">
                    <UserProfileCard
                      name={currentAccount.name}
                      isPremium={isPremium}
                      hasPremiumAnywhere={hasPremiumAnywhere}
                      accountsCount={accounts.length}
                      avatarSrc={avatarSrc}
                      onCycleAccount={handleCycleAccount}
                    />

                    <TrustedDevicesList
                      trusted={trusted}
                      onlineDeviceMap={onlineDeviceMap}
                      isScanning={isScanning}
                      focusedDeviceId={focusedDeviceId}
                      onScan={scan}
                      onSelect={handleSelectTrustedDevice}
                      onFocusedDeviceChange={setFocusedDeviceId}
                      onRemove={setDeviceToRemove}
                    />

                    <JavaFriendsAndLanPanel
                      account={currentAccount}
                      isPremium={isPremium}
                      discovered={discovered}
                      trusted={trusted}
                      friends={friends}
                      isScanning={isScanning}
                      isRequesting={isRequesting}
                      onRequestTrust={sendTrustRequest}
                      onTrustDevice={trustDevice}
                    />
                  </div>

                  <LanTransferPanel
                    transferTarget={transferTarget}
                    selectedFriend={selectedFriend}
                    selectedTargetOnline={selectedTargetOnline}
                    timelineRef={timelineRef}
                    transferHistory={transferHistory}
                    progressMap={progressMap}
                    transferType={transferType}
                    instances={instances}
                    saves={saves}
                    selectedInstance={selectedInstance}
                    selectedSave={selectedSave}
                    activeProgress={activeProgress}
                    isPushing={isPushing}
                    onCloseTransfer={() => setTransferTarget(null)}
                    onTransferTypeChange={setTransferType}
                    onSelectedInstanceChange={setSelectedInstance}
                    onSelectedSaveChange={setSelectedSave}
                    onPush={executePush}
                  />
                </div>
              </div>
            </motion.div>
          </FocusBoundary>
        )}
      </AnimatePresence>

      <LanTransferDialogs
        incomingRequest={incomingRequest}
        incomingData={incomingData}
        progressMap={progressMap}
        instances={instances}
        receiveTargetInstance={receiveTargetInstance}
        isApplying={isApplying}
        isRejecting={isRejecting}
        deviceToRemove={deviceToRemove}
        onResolveTrustRequest={resolveTrustRequest}
        onRejectIncoming={rejectIncoming}
        onApplyIncoming={executeApply}
        onReceiveTargetInstanceChange={setReceiveTargetInstance}
        onDeviceToRemoveChange={setDeviceToRemove}
        onRemoveTrustedDevice={removeTrustedDevice}
      />
    </>
  );
};
