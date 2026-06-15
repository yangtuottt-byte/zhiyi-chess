'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * 安全使用 Electron IPC API 的 Hook。
 *
 * 解决 Next.js SSR 兼容问题：
 * - mounted: 仅在客户端挂载后才为 true
 * - isElectron: 异步检测 window.api 是否注入成功（含轮询兜底）
 * - analyzePosition / getEngineStatus: 每次调用实时检查 window.api
 */
export function useElectron() {
  const [mounted, setMounted] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [envChecked, setEnvChecked] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 立即检查一次
    if (typeof window !== 'undefined' && window.api) {
      console.log('[useElectron] window.api 已就绪');
      setIsElectron(true);
      setEnvChecked(true);
      return;
    }

    // 轮询兜底：preload 可能稍有延迟
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (typeof window !== 'undefined' && window.api) {
        console.log(`[useElectron] window.api 在第 ${attempts} 次轮询后就绪`);
        setIsElectron(true);
        setEnvChecked(true);
        clearInterval(timer);
      } else if (attempts >= 30) {
        console.warn('[useElectron] 轮询超时，window.api 不可用（可能在浏览器中运行）');
        setEnvChecked(true);
        clearInterval(timer);
      }
    }, 100);

    return () => clearInterval(timer);
  }, []);

  /** 每次调用时实时检查 window.api，不走缓存 ref */
  const analyzePosition = useCallback(async (fen: string) => {
    if (typeof window === 'undefined' || !window.api) {
      throw new Error('不在 Electron 环境中 — 请通过 electron:dev 启动');
    }
    console.log('[useElectron] → analyzePosition 已发送 IPC');
    return window.api.analyzePosition(fen);
  }, []);

  const getEngineStatus = useCallback(async () => {
    if (typeof window === 'undefined' || !window.api) {
      throw new Error('不在 Electron 环境中 — 请通过 electron:dev 启动');
    }
    console.log('[useElectron] → getEngineStatus 已发送 IPC');
    return window.api.getEngineStatus();
  }, []);

  return { mounted, isElectron, envChecked, analyzePosition, getEngineStatus };
}
