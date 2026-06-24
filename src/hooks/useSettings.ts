'use client';

import { useState, useCallback } from 'react';
import { loadSettings, saveSettings, updateSetting, ANIMATION_DURATION, type AppSettings, type AnimationSpeed } from '@/lib/settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  const refresh = useCallback(() => setSettings(loadSettings()), []);

  const setSoundEnabled = useCallback((v: boolean) => {
    const updated = updateSetting('soundEnabled', v);
    setSettings(updated);
  }, []);

  const setAnimationSpeed = useCallback((speed: AnimationSpeed) => {
    const updated = updateSetting('animationSpeed', speed);
    setSettings(updated);
  }, []);

  const save = useCallback((s: AppSettings) => {
    saveSettings(s);
    setSettings(s);
  }, []);

  return {
    settings,
    setSoundEnabled,
    setAnimationSpeed,
    save,
    refresh,
    animDuration: ANIMATION_DURATION[settings.animationSpeed],
  };
}
