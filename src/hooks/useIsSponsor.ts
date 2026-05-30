import { useMemo } from 'react';
import { useAccountStore } from '../store/useAccountStore';
import donorData from '../assets/config/donors.json';

const normalizeUuid = (uuid?: string | null) => {
  return (uuid || '').replace(/-/g, '').toLowerCase();
};

export const useIsSponsor = (): boolean => {
  const { accounts, activeAccountId } = useAccountStore();
  return useMemo(() => {
    const currentAccount = accounts.find((a) => a.uuid === activeAccountId);
    if (!currentAccount) return false;

    const userUuidNormalized = normalizeUuid(currentAccount.uuid);
    const sponsorUuids = donorData.uuids || [];
    return sponsorUuids.some((uuid) => normalizeUuid(uuid) === userUuidNormalized);
  }, [accounts, activeAccountId]);
};
