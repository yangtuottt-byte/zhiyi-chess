'use client';

import React from 'react';
import { Side } from '@/core/types';

export interface ControlsPanelProps {
  // 游戏操作
  onUndo: () => void;
  onReset: () => void;
  canUndo: boolean;
  moveCount: number;

  // AI 分析
  onAnalyze: () => void;
  onClearHints: () => void;
  loading: boolean;
  hasHints: boolean;
  isElectron: boolean;

  // 状态
  engineStatus: string;
  currentSide: Side;
  isInCheck: boolean;
  isCheckmated: boolean;

  // AI 结果
  aiResult: {
    sideToMove?: string;
    moves: Array<{
      multipv: number;
      score: number;
      scoreType?: string;
      depth: number;
      pv: string[];
    }>;
  } | null;
  error: string | null;
}

export default function ControlsPanel({
  onUndo, onReset, canUndo, moveCount,
  onAnalyze, onClearHints, loading, hasHints, isElectron,
  engineStatus, currentSide, isInCheck, isCheckmated,
  aiResult, error,
}: ControlsPanelProps) {
  return (
    <div className="w-full max-w-[552px] space-y-4">
      {/* ── 状态栏 ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>
          引擎:{' '}
          <span className={engineStatus.includes('就绪') ? 'text-green-400' : 'text-yellow-400'}>
            {engineStatus}
          </span>
        </span>
        <span>
          行棋:{' '}
          <span className={currentSide === Side.Red ? 'text-red-400 font-semibold' : 'text-gray-200 font-semibold'}>
            {currentSide === Side.Red ? '红方' : '黑方'}
          </span>
        </span>
        {isInCheck && <span className="text-red-400 font-bold animate-pulse">将军!</span>}
        {isCheckmated && <span className="text-red-500 font-bold text-base">将死!</span>}
        <span className="text-gray-600">步数: {moveCount}</span>
      </div>

      {/* ── 按钮区 ── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded border border-gray-600 px-4 py-1.5 text-sm text-gray-300 transition hover:border-gray-400 hover:bg-gray-700 disabled:opacity-30"
        >
          悔棋
        </button>
        <button
          onClick={onReset}
          className="rounded border border-gray-600 px-4 py-1.5 text-sm text-gray-300 transition hover:border-gray-400 hover:bg-gray-700"
        >
          新局
        </button>
        <button
          onClick={onAnalyze}
          disabled={loading || !isElectron}
          className="rounded bg-amber-500 px-4 py-1.5 text-sm font-semibold text-gray-900 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? '分析中...' : 'AI 分析'}
        </button>
        {hasHints && (
          <button
            onClick={onClearHints}
            className="rounded border border-gray-500 px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-700"
          >
            清除提示
          </button>
        )}
      </div>

      {/* ── 错误 ── */}
      {error && (
        <div className="rounded border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* ── AI 推荐列表 ── */}
      {aiResult && aiResult.moves.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
          <h3 className="mb-2 text-xs font-semibold text-gray-300">
            AI 推荐走法 (depth={aiResult.moves[0]?.depth}，红方视角)
          </h3>
          <div className="space-y-1.5">
            {aiResult.moves.map((m) => (
              <div
                key={m.multipv}
                className={`flex items-center gap-3 rounded border px-3 py-1.5 font-mono text-sm ${
                  m.multipv === 1
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-gray-700/50'
                }`}
              >
                <span className="font-bold text-amber-400 text-xs">#{m.multipv}</span>
                <span
                  className={`text-xs tabular-nums ${
                    m.score > 0 ? 'text-green-400' : m.score < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}
                >
                  {m.score > 0 ? '+' : ''}{m.score}
                </span>
                <span className="text-gray-300 text-xs">
                  {m.pv.slice(0, 4).join(' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
