'use client';

import React from 'react';
import type { Winner } from '@/hooks/useChessGame';

export interface GameOverModalProps {
  winner: Winner;
  reason: string;
  onNewGame: () => void;
  onBackToHome?: () => void;
  onExport?: () => void;
}

export default function GameOverModal({ winner, reason, onNewGame, onBackToHome, onExport }: GameOverModalProps) {
  const isDraw = winner === 'draw';
  const isRedWin = winner === 'w';

  const icon = isDraw ? '和' : isRedWin ? '帅' : '将';
  const title = isDraw ? '平局' : isRedWin ? '红方胜' : '黑方胜';

  const iconBg = isDraw
    ? 'bg-amber-900/50 text-amber-400 ring-2 ring-amber-500'
    : isRedWin
      ? 'bg-red-900/50 text-red-400 ring-2 ring-red-500'
      : 'bg-gray-800 text-gray-300 ring-2 ring-gray-500';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-gray-900/95 px-10 py-8 shadow-2xl ring-1 ring-gray-700">
        {/* 结果图标 */}
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl font-bold ${iconBg}`}
        >
          {icon}
        </div>

        {/* 标题 */}
        <h2 className="text-2xl font-bold text-amber-400">{title}</h2>

        {/* 原因 */}
        <p className="text-sm text-gray-400">{reason}</p>

        {/* 导出棋谱 */}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-6 py-2.5 text-sm font-semibold text-cyan-300 backdrop-blur-md transition-all hover:border-cyan-400/50 hover:bg-cyan-500/20 hover:text-cyan-200 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出棋谱
          </button>
        )}

        {/* 按钮组 */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={onNewGame}
            className="rounded-lg bg-amber-500 px-8 py-2.5 font-semibold text-gray-900 shadow-lg transition-all hover:bg-amber-400 hover:shadow-xl active:scale-95"
          >
            再来一局
          </button>
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="rounded-lg border border-gray-600 px-6 py-2.5 text-sm text-slate-400 transition-all hover:border-gray-400 hover:text-slate-200"
            >
              返回主菜单
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
