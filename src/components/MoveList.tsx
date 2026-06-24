'use client';

import type { MoveRecord } from '@/hooks/useChessGame';
import { positionsToUci } from '@/lib/uci';
import { audio } from '@/lib/audio';

export interface MoveListProps {
  fenHistory: string[];
  moveRecords: (MoveRecord | null)[];
  currentMoveIndex: number;
  onJump: (index: number) => void;
}

/** 根据 FEN 回合标记判断该步棋的阵营 */
function sideFromFen(fen: string): '红' | '黑' {
  // FEN 中 side-to-move 是"下一步该谁走"，
  // 所以 FEN 前一步的走子方是对方
  const parts = fen.split(' ');
  return parts[1] === 'w' ? '黑' : '红';
}

export default function MoveList({
  fenHistory,
  moveRecords,
  currentMoveIndex,
  onJump,
}: MoveListProps) {
  // moves[i] 对应从 fenHistory[i-1] 走到 fenHistory[i]
  const moves: Array<{ index: number; record: MoveRecord | null; fen: string }> = [];
  for (let i = 1; i < fenHistory.length; i++) {
    moves.push({ index: i, record: moveRecords[i] ?? null, fen: fenHistory[i] });
  }

  if (moves.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-xs text-slate-500">暂无走子记录</p>
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-800 bg-gray-900/60 custom-scrollbar">
      <div className="divide-y divide-gray-800/50">
        {moves.map(({ index, record, fen }) => {
          const isActive = index === currentMoveIndex;
          const side = sideFromFen(fen);
          const uci = record ? positionsToUci(record.from, record.to) : '?';

          return (
            <button
              key={index}
              onClick={() => { audio.playUI(); onJump(index); }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                isActive
                  ? 'bg-amber-500/10 border-l-2 border-amber-500'
                  : 'border-l-2 border-transparent hover:bg-gray-800/50'
              }`}
            >
              {/* 步数 */}
              <span className="text-xs font-mono text-slate-500 w-10 shrink-0 tabular-nums">
                #{index}
              </span>

              {/* 阵营标记 */}
              <span
                className={`text-xs font-bold w-5 shrink-0 ${
                  side === '红' ? 'text-red-400' : 'text-gray-300'
                }`}
              >
                {side}
              </span>

              {/* 走法 */}
              <span className="text-xs font-mono text-slate-300 tracking-wide">
                {uci}
              </span>

              {/* 当前指示 */}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
