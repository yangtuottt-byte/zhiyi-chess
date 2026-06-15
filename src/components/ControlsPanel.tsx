'use client';

import type { GameStatus } from '@/hooks/useChessGame';

export interface ControlsPanelProps {
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
}

const DEPTH_OPTIONS = [
  { label: '简单', value: 5 },
  { label: '中等', value: 10 },
  { label: '困难', value: 15 },
];

export default function ControlsPanel({
  aiDepth, onSetAiDepth,
  engineStatus, currentTurn, gameStatus, checkSide, moveCount,
  onUndo, onReset, onBackToHome, canUndo,
  onAnalyze, onClearHints, aiThinking, hasHints, isElectron,
  aiResult, error,
}: ControlsPanelProps) {
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
        {gameStatus === 'gameover' && (
          <span className="text-red-500 font-bold">对局结束</span>
        )}
        <span className="text-gray-600">步数: {moveCount}</span>
      </div>

      {/* ── AI 难度选择 ── */}
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

      {/* ── 操作按钮 ── */}
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

        {/* 返回主菜单 */}
        <button
          onClick={onBackToHome}
          className="ml-auto rounded border border-gray-500/50 px-4 py-1.5 text-sm text-gray-400 transition hover:border-gray-400 hover:text-gray-200"
        >
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
