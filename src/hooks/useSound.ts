'use client';

import { useState, useEffect, useCallback } from 'react';
import { audio } from '@/lib/audio';

/**
 * 响应式音效 Hook。
 *
 * 用法:
 *   const { isEnabled, toggle, playMove, playUI } = useSound();
 *   <button onClick={toggle}>{isEnabled ? '🔊' : '🔇'}</button>
 */
export function useSound() {
  const [isEnabled, setIsEnabled] = useState(() => audio.isEnabled());

  useEffect(() => {
    setIsEnabled(audio.isEnabled());
    return audio.onChange(setIsEnabled);
  }, []);

  const toggle = useCallback(() => {
    audio.toggle();
  }, []);

  const playMove = useCallback(() => audio.playMove(), []);
  const playCapture = useCallback(() => audio.playCapture(), []);
  const playCheck = useCallback(() => audio.playCheck(), []);
  const playGameOver = useCallback((status: 'win' | 'lose' | 'draw') => audio.playGameOver(status), []);
  const playUI = useCallback(() => audio.playUI(), []);

  return { isEnabled, toggle, playMove, playCapture, playCheck, playGameOver, playUI };
}
