'use client';

import React from 'react';
import type { Winner } from '@/hooks/useChessGame';

export interface GameOverModalProps {
  winner: Winner;
  reason: string;
  onNewGame: () => void;
  onBackToHome?: () => void;
}

export default function GameOverModal({ winner, reason, onNewGame, onBackToHome }: GameOverModalProps) {
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
