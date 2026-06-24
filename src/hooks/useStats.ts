'use client';

import { useState, useCallback } from 'react';
import { loadStats, recordResult, clearStats, winRate, type StatsData } from '@/lib/stats';

export function useStats() {
  const [stats, setStats] = useState<StatsData>(() => loadStats());

  const refresh = useCallback(() => setStats(loadStats()), []);

  const record = useCallback((result: 'win' | 'lose' | 'draw') => {
    const updated = recordResult(result);
    setStats(updated);
  }, []);

  const clear = useCallback(() => {
    clearStats();
    setStats({ wins: 0, losses: 0, draws: 0, totalGames: 0 });
  }, []);

  return { stats, record, clear, refresh, winRate: winRate(stats) };
}
