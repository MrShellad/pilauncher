import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAccountStore } from '../store/useAccountStore';
import donorData from '../assets/config/donors.json';

interface DonorEntry {
  mcUuid?: string | null;
  mcName?: string | null;
}

const normalizeUuid = (uuid?: string | null) => {
  return (uuid || '').replace(/-/g, '').toLowerCase();
};

let globalDonorsCache: DonorEntry[] | null = null;
let globalDonorsPromise: Promise<DonorEntry[]> | null = null;

export const useIsSponsor = (): boolean => {
  const { accounts, activeAccountId } = useAccountStore();
  const currentAccount = useMemo(() => accounts.find((a) => a.uuid === activeAccountId), [accounts, activeAccountId]);

  const [dynamicDonors, setDynamicDonors] = useState<DonorEntry[] | null>(globalDonorsCache);

  useEffect(() => {
    if (globalDonorsCache) {
      return;
    }

    if (!globalDonorsPromise) {
      globalDonorsPromise = invoke<DonorEntry[]>('fetch_donors')
        .then((data) => {
          globalDonorsCache = Array.isArray(data) ? data : [];
          return globalDonorsCache;
        })
        .catch(() => {
          globalDonorsPromise = null;
          return [];
        });
    }

    globalDonorsPromise.then((data) => {
      setDynamicDonors(data);
    });
  }, []);

  return useMemo(() => {
    if (!currentAccount) return false;

    // 1. Check local static donor config first
    const userUuidNormalized = normalizeUuid(currentAccount.uuid);
    const sponsorUuids = donorData.uuids || [];
    if (sponsorUuids.some((uuid) => normalizeUuid(uuid) === userUuidNormalized)) {
      return true;
    }

    // 2. Check dynamic donors list (either from local state or global cache)
    const activeDynamicDonors = dynamicDonors || globalDonorsCache;
    if (activeDynamicDonors) {
      return activeDynamicDonors.some(
        (d) =>
          normalizeUuid(d.mcUuid) === userUuidNormalized ||
          (d.mcName && currentAccount.name && d.mcName.toLowerCase() === currentAccount.name.toLowerCase())
      );
    }

    return false;
  }, [currentAccount, dynamicDonors]);
};
