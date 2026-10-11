import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SKIN_NOTE_STORAGE_PREFIX = 'wardrobe:skin-notes:';
const MAX_SKIN_NOTE_LENGTH = 28;

export function useWardrobeSkinNotes(accountUuid?: string | null) {
  const [skinNotes, setSkinNotes] = useState<Record<string, string>>({});
  const isNotesLoadedRef = useRef(false);
  const storageKey = useMemo(
    () => (accountUuid ? `${SKIN_NOTE_STORAGE_PREFIX}${accountUuid}` : null),
    [accountUuid]
  );

  useEffect(() => {
    isNotesLoadedRef.current = false;

    if (!storageKey) {
      setSkinNotes({});
      isNotesLoadedRef.current = true;
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setSkinNotes({});
        isNotesLoadedRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const normalized = Object.entries(parsed).reduce<Record<string, string>>((acc, [assetId, noteValue]) => {
        if (typeof noteValue !== 'string') return acc;
        const note = noteValue.slice(0, MAX_SKIN_NOTE_LENGTH);
        if (!note.trim()) return acc;
        acc[assetId] = note;
        return acc;
      }, {});
      setSkinNotes(normalized);
    } catch {
      setSkinNotes({});
    } finally {
      isNotesLoadedRef.current = true;
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !isNotesLoadedRef.current || typeof window === 'undefined') {
      return;
    }

    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(skinNotes));
      } catch {
        // Keep in-memory notes when local storage is unavailable.
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [skinNotes, storageKey]);

  const handleChangeSkinNote = useCallback((assetId: string, note: string) => {
    const normalizedNote = note.slice(0, MAX_SKIN_NOTE_LENGTH);
    setSkinNotes((previous) => {
      const trimmedNote = normalizedNote.trim();

      if (!trimmedNote) {
        if (!(assetId in previous)) {
          return previous;
        }
        const nextNotes = { ...previous };
        delete nextNotes[assetId];
        return nextNotes;
      }

      if (previous[assetId] === normalizedNote) {
        return previous;
      }

      return {
        ...previous,
        [assetId]: normalizedNote,
      };
    });
  }, []);

  return {
    skinNotes,
    handleChangeSkinNote,
  };
}
