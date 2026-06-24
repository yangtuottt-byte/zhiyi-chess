'use client';

import { useState, useCallback } from 'react';
import { loadSlots, saveSlot, deleteSlot, type SaveSlot } from '@/lib/storage';

export function useSaveManager() {
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);

  const refresh = useCallback(() => {
    setSlots(loadSlots());
  }, []);

  const openSaveModal = useCallback(() => {
    refresh();
    setShowSaveModal(true);
  }, [refresh]);

  const closeSaveModal = useCallback(() => {
    setShowSaveModal(false);
  }, []);

  const openLoadModal = useCallback(() => {
    refresh();
    setShowLoadModal(true);
  }, [refresh]);

  const closeLoadModal = useCallback(() => {
    setShowLoadModal(false);
  }, []);

  const addSlot = useCallback((slot: SaveSlot) => {
    saveSlot(slot);
    refresh();
  }, [refresh]);

  const removeSlot = useCallback((id: string) => {
    deleteSlot(id);
    refresh();
  }, [refresh]);

  return {
    slots,
    showSaveModal,
    showLoadModal,
    openSaveModal,
    closeSaveModal,
    openLoadModal,
    closeLoadModal,
    addSlot,
    removeSlot,
    refresh,
  };
}
