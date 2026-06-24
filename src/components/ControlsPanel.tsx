'use client';

import type { GameMode, GameStatus } from '@/hooks/useChessGame';
import { audio } from '@/lib/audio';

export interface ControlsPanelProps {
  // 模式
  gameMode: GameMode;

  // 难度
  aiDepth: number;
  onSetAiDepth: (depth: number) => void;

  // 状态
  engineStatus: string;
  currentTurn: 'w' | 'b';
  gameStatus: GameStatus;
  checkSide: 'w' | 'b' | null;
  moveCount: number;

  // 操作
  onUndo: () => void;
  onReset: () => void;
  onBackToHome: () => void;
  canUndo: boolean;

  // AI 分析
  onAnalyze: () => void;
  onClearHints: () => void;
  aiThinking: boolean;
  hasHints: boolean;
  isElectron: boolean;

  // 结果
  aiResult: {
    moves: Array<{
      multipv: number;
      score: number;
      depth: number;
      pv: string[];
    }>;
  } | null;
  error: string | null;

  // 对战交互
  onResign: () => void;
  onDraw: () => void;

  // 存档
  onSave: () => void;
  onLoad: () => void;
  hasSavedGame: boolean;
}

const DEPTH_OPTIONS = [
  { label: '简单', value: 5 },
  { label: '中等', value: 10 },
  { label: '困难', value: 15 },
];

export default function ControlsPanel({
  gameMode,
  aiDepth, onSetAiDepth,
  engineStatus, currentTurn, gameStatus, checkSide, moveCount,
  onUndo, onReset, onBackToHome, canUndo,
  onAnalyze, onClearHints, aiThinking, hasHints, isElectron,
  aiResult, error,
  onResign, onDraw,
  onSave, onLoad, hasSavedGame,
}: ControlsPanelProps) {
  const isGameOver = gameStatus === 'gameover';

  return (
    <div className="w-full max-w-[552px] space-y-3">
      {/* ── 信息条 ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>
          引擎:{' '}
          <span className={engineStatus.includes('就绪') ? 'text-green-400' : 'text-yellow-400'}>
            {engineStatus}
          </span>
        </span>
        <span>
          行棋:{' '}
          <span className={currentTurn === 'w' ? 'text-red-400 font-semibold' : 'text-gray-200 font-semibold'}>
            {currentTurn === 'w' ? '红方' : '黑方'}
          </span>
        </span>
        {aiThinking && (
          <span className="text-amber-400 font-bold animate-pulse">AI 思考中...</span>
        )}
        {checkSide && (
          <span className="text-red-400 font-bold animate-pulse">
            将军! ({checkSide === 'w' ? '红方' : '黑方'}被将)
          </span>
        )}
        {isGameOver && (
          <span className="text-red-500 font-bold">对局结束</span>
        )}
        <span className="text-gray-600">步数: {moveCount}</span>
      </div>

      {/* ── AI 难度选择 ── */}
      {gameMode !== 'practice' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">AI 难度:</span>
          <div className="flex rounded border border-gray-700 bg-gray-800/50 p-0.5">
            {DEPTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSetAiDepth(opt.value)}
                className={`rounded px-3 py-1 text-xs transition ${
                  aiDepth === opt.value
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 操作按钮 ── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { audio.playUI(); onUndo(); }}
          disabled={!canUndo}
          className="rounded border border-gray-600 px-4 py-1.5 text-sm text-gray-300 transition hover:border-gray-400 hover:bg-gray-700 disabled:opacity-30"
        >
          悔棋
        </button>
        <button
          onClick={() => { audio.playUI(); onReset(); }}
          className="rounded border border-gray-600 px-4 py-1.5 text-sm text-gray-300 transition hover:border-gray-400 hover:bg-gray-700"
        >
          新局
        </button>

        {/* ── 练习模式: 存档/读档 ── */}
        {gameMode === 'practice' && (
          <>
            <button
              onClick={() => { audio.playUI(); onSave(); }}
              disabled={isGameOver}
              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 disabled:opacity-30"
            >
              保存对局
            </button>
            <button
              onClick={() => { audio.playUI(); onLoad(); }}
              disabled={!hasSavedGame}
              className="rounded border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-400 transition hover:border-blue-400/60 hover:bg-blue-500/20 disabled:opacity-30"
            >
              读取对局
            </button>
          </>
        )}

        {/* ── 对战模式: 认输/求和 ── */}
        {gameMode === 'battle' && !isGameOver && (
          <>
            <button
              onClick={() => { audio.playUI(); onResign(); }}
              className="rounded border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-sm text-red-400 transition hover:border-red-400/60 hover:bg-red-500/20"
            >
              认输
            </button>
            <button
              onClick={() => { audio.playUI(); onDraw(); }}
              className="rounded border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-sm text-yellow-400 transition hover:border-yellow-400/60 hover:bg-yellow-500/20"
            >
              求和
            </button>
          </>
        )}

        {gameMode !== 'practice' && (
          <>
            <button
              onClick={() => { audio.playUI(); onAnalyze(); }}
              disabled={aiThinking || !isElectron}
              className="rounded bg-amber-500 px-4 py-1.5 text-sm font-semibold text-gray-900 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {aiThinking ? '分析中...' : 'AI 分析'}
            </button>
            {hasHints && (
              <button
                onClick={onClearHints}
                className="rounded border border-gray-500 px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-700"
              >
                清除提示
              </button>
            )}
          </>
        )}

        {/* 返回主菜单 */}
        <button
          onClick={() => { audio.playUI(); onBackToHome(); }}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-400 backdrop-blur-md transition-all duration-300 hover:border-slate-500/40 hover:bg-white/[0.08] hover:text-slate-200"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回主菜单
        </button>
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
                  m.multipv === 1 ? 'border-amber-500/30 bg-amber-500/5' : 'border-gray-700/50'
                }`}
              >
                <span className="text-xs font-bold text-amber-400">#{m.multipv}</span>
                <span className={`text-xs tabular-nums ${m.score > 0 ? 'text-green-400' : m.score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {m.score > 0 ? '+' : ''}{m.score}
                </span>
                <span className="text-xs text-gray-300">{m.pv.slice(0, 4).join(' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
