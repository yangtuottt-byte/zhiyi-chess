'use client';

import { useCallback } from 'react';
import { audio } from '@/lib/audio';

/**
 * 便捷音效 Hook。
 *
 * 用法:
 *   const { playMove, playCapture, playUI } = useSound();
 *   playMove();
 */
export function useSound() {
  const playMove = useCallback(() => audio.playMove(), []);
  const playCapture = useCallback(() => audio.playCapture(), []);
  const playCheck = useCallback(() => audio.playCheck(), []);
  const playGameOver = useCallback(() => audio.playGameOver(), []);
  const playUI = useCallback(() => audio.playUI(), []);

  return { playMove, playCapture, playCheck, playGameOver, playUI };
}
