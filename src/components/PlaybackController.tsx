'use client';

import { audio } from '@/lib/audio';

export interface PlaybackControllerProps {
  currentMoveIndex: number;
  totalMoves: number;
  isReviewing: boolean;
  onStart: () => void;
  onBack: () => void;
  onForward: () => void;
  onEnd: () => void;
}

const btnBase =
  'flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 p-2 transition-all duration-200 hover:border-gray-500 hover:bg-gray-700/80 active:scale-95';
const btnDisabled = 'opacity-25 pointer-events-none';

export default function PlaybackController({
  currentMoveIndex,
  totalMoves,
  isReviewing,
  onStart,
  onBack,
  onForward,
  onEnd,
}: PlaybackControllerProps) {
  const atStart = currentMoveIndex <= 0;
  const atEnd = currentMoveIndex >= totalMoves;

  return (
    <div className="flex items-center gap-2">
      {/* 步数显示 */}
      <div className="flex items-center gap-1.5 mr-1">
        <span className="text-xs text-slate-400 tabular-nums min-w-[60px] text-center">
          第 {currentMoveIndex} / {totalMoves} 步
        </span>
        {isReviewing && (
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 rounded-full px-2 py-0.5 animate-pulse">
            回看中
          </span>
        )}
      </div>

      {/* ⏪ 回到开局 */}
      <button
        title="回到开局"
        disabled={atStart}
        className={`${btnBase} ${atStart ? btnDisabled : ''}`}
        onClick={() => { audio.playUI(); onStart(); }}
      >
        <svg className="h-4 w-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m-7 7h16" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 19l-6-6" />
        </svg>
      </button>

      {/* ◀ 上一步 */}
      <button
        title="上一步"
        disabled={atStart}
        className={`${btnBase} ${atStart ? btnDisabled : ''}`}
        onClick={() => { audio.playUI(); onBack(); }}
      >
        <svg className="h-4 w-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* ▶ 下一步 */}
      <button
        title="下一步"
        disabled={atEnd}
        className={`${btnBase} ${atEnd ? btnDisabled : ''}`}
        onClick={() => { audio.playUI(); onForward(); }}
      >
        <svg className="h-4 w-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* ⏩ 最新局面 */}
      <button
        title="最新局面"
        disabled={atEnd}
        className={`${btnBase} ${atEnd ? btnDisabled : ''}`}
        onClick={() => { audio.playUI(); onEnd(); }}
      >
        <svg className="h-4 w-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
