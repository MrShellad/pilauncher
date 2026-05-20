import { useCallback, useEffect, useRef, useState } from 'react';

export const useBasicPanelStatus = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMsg(''), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  return {
    isSaving,
    setIsSaving,
    successMsg,
    triggerSuccess,
  };
};
