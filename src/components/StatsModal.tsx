'use client';

import type { StatsData } from '@/lib/stats';
import { audio } from '@/lib/audio';

interface StatsModalProps {
  stats: StatsData;
  winRate: number;
  onClear: () => void;
  onClose: () => void;
}

export default function StatsModal({ stats, winRate, onClear, onClose }: StatsModalProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-gray-900/95 px-10 py-8 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-amber-400">战绩统计</h2>

        {/* ── 胜率环 ── */}
        <div className="relative flex items-center justify-center">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#1f2937" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none" stroke="url(#winGrad)"
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - winRate / 100)}`}
              className="transition-all duration-700"
            />
            <defs>
              <linearGradient id="winGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute text-2xl font-black text-amber-400">{winRate}%</span>
        </div>

        <p className="text-xs text-slate-500 -mt-3">胜率</p>

        {/* ── 数据行 ── */}
        <div className="grid grid-cols-3 gap-6 w-full">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-green-400">{stats.wins}</span>
            <span className="text-xs text-slate-500">胜利</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-red-400">{stats.losses}</span>
            <span className="text-xs text-slate-500">失败</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-amber-400">{stats.draws}</span>
            <span className="text-xs text-slate-500">和棋</span>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          总对局: <span className="text-slate-300 font-semibold">{stats.totalGames}</span> 场
        </div>

        {/* ── 按钮 ── */}
        <div className="flex gap-3">
          <button
            onClick={() => { audio.playUI(); onClear(); }}
            disabled={stats.totalGames === 0}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs text-red-400 transition hover:border-red-400/50 hover:bg-red-500/20 disabled:opacity-30"
          >
            清空战绩
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-600 px-5 py-1.5 text-xs text-slate-400 transition hover:border-gray-400 hover:text-slate-200"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
