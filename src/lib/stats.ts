const STATS_KEY = 'ZhiYi_Stats';

export interface StatsData {
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
}

const DEFAULT_STATS: StatsData = { wins: 0, losses: 0, draws: 0, totalGames: 0 };

export function loadStats(): StatsData {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function saveStats(data: StatsData): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(data));
  } catch { /* 静默 */ }
}

export function recordResult(result: 'win' | 'lose' | 'draw'): StatsData {
  const stats = loadStats();
  stats.totalGames++;
  if (result === 'win') stats.wins++;
  else if (result === 'lose') stats.losses++;
  else stats.draws++;
  saveStats(stats);
  return stats;
}

export function clearStats(): void {
  try {
    localStorage.removeItem(STATS_KEY);
  } catch { /* 静默 */ }
}

export function winRate(stats: StatsData): number {
  if (stats.totalGames === 0) return 0;
  return Math.round((stats.wins / stats.totalGames) * 100);
}
