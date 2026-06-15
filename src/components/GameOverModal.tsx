'use client';

import React from 'react';

export interface GameOverModalProps {
  winner: 'w' | 'b';
  reason: string;
  onNewGame: () => void;
}

export default function GameOverModal({ winner, reason, onNewGame }: GameOverModalProps) {
  const isRedWin = winner === 'w';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-gray-900/95 px-10 py-8 shadow-2xl ring-1 ring-gray-700">
        {/* 结果图标 */}
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl font-bold ${
            isRedWin
              ? 'bg-red-900/50 text-red-400 ring-2 ring-red-500'
              : 'bg-gray-800 text-gray-300 ring-2 ring-gray-500'
          }`}
        >
          {isRedWin ? '帅' : '将'}
        </div>

        {/* 标题 */}
        <h2 className="text-2xl font-bold text-amber-400">
          {isRedWin ? '红方胜' : '黑方胜'}
        </h2>

        {/* 原因 */}
        <p className="text-sm text-gray-400">{reason}</p>

        {/* 按钮 */}
        <button
          onClick={onNewGame}
          className="mt-2 rounded-lg bg-amber-500 px-8 py-2.5 font-semibold text-gray-900 shadow-lg transition-all hover:bg-amber-400 hover:shadow-xl active:scale-95"
        >
          再来一局
        </button>
      </div>
    </div>
  );
}
