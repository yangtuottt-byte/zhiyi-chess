'use client';

import { useState, useCallback, useEffect } from 'react';
import { Side } from '@/core/types';
import { useChessGame } from '@/hooks/useChessGame';
import { useElectron } from '@/hooks/useElectron';
import { uciToPositions } from '@/lib/uci';
import Chessboard from '@/components/Chessboard';

export default function Home() {
  const { isElectron, envChecked, analyzePosition, getEngineStatus } =
    useElectron();

  const {
    board,
    fen,
    currentSide,
    selectedPos,
    legalMoves,
    moveHistory,
    aiHints,
    isInCheckFlag,
    isCheckmatedFlag,
    handleCellClick,
    undoMove,
    resetGame,
    setAIHints,
  } = useChessGame();

  // ── 引擎状态 ─────────────────────────────────────────────────

  const [engineStatus, setEngineStatus] = useState('检测中...');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);

  useEffect(() => {
    if (!envChecked) return;
    if (!isElectron) {
      setEngineStatus('浏览器模式');
      return;
    }
    getEngineStatus()
      .then((s) => setEngineStatus(s.ready ? '引擎就绪' : '引擎未就绪'))
      .catch((e) => setEngineStatus('检查失败: ' + e.message));
  }, [envChecked, isElectron, getEngineStatus]);

  // ── AI 分析 ─────────────────────────────────────────────────

  const analyze = useCallback(async () => {
    console.log('[page] AI分析, FEN:', fen);
    setLoading(true);
    setError(null);
    setAiResult(null);

    try {
      const res = await analyzePosition(fen);
      setAiResult(res);

      // 将引擎返回的 PV 解析为棋盘上的 from/to 提示
      const hints = res.moves.map((m: any) => {
        const parsed = uciToPositions(m.pv[0]);
        return {
          multipv: m.multipv,
          from: parsed?.from ?? { row: 0, col: 0 },
          to: parsed?.to ?? { row: 0, col: 0 },
          score: m.score,
          depth: m.depth,
          pv: m.pv,
        };
      });

      setAIHints(hints);
      console.log('[page] AI 提示已设置:', hints);
    } catch (e: any) {
      setError(e.message);
      console.error('[page] AI分析失败:', e);
    } finally {
      setLoading(false);
    }
  }, [fen, analyzePosition, setAIHints]);

  // ── 清除 AI 提示 ────────────────────────────────────────────

  const clearHints = useCallback(() => {
    setAIHints([]);
    setAiResult(null);
  }, [setAIHints]);

  // ── 渲染 ─────────────────────────────────────────────────────

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 px-4 py-6">
      {/* 标题栏 */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-amber-400">AI象棋教练</h1>
        <span className="text-xs text-gray-500">
          {isElectron ? 'Electron' : 'Browser'}
        </span>
      </div>

      {/* 状态行 */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <span className="text-gray-500">
          引擎: <span className={engineStatus.includes('就绪') ? 'text-green-400' : 'text-yellow-400'}>{engineStatus}</span>
        </span>
        <span className="text-gray-500">
          当前: <span className={currentSide === Side.Red ? 'text-red-400' : 'text-gray-300 font-bold'}>
            {currentSide === Side.Red ? '红方' : '黑方'}
          </span>
        </span>
        {isInCheckFlag && (
          <span className="text-red-400 font-bold animate-pulse">将军!</span>
        )}
        {isCheckmatedFlag && (
          <span className="text-red-500 font-bold text-lg">将死!</span>
        )}
        {moveHistory.length > 0 && (
          <span className="text-gray-600">步数: {moveHistory.length}</span>
        )}
      </div>

      {/* 棋盘 */}
      <div className="rounded-xl bg-amber-950/30 p-3 shadow-2xl">
        <Chessboard
          board={board}
          selectedPos={selectedPos}
          legalMoves={legalMoves}
          aiHints={aiHints}
          currentSide={currentSide}
          onCellClick={handleCellClick}
        />
      </div>

      {/* 控制按钮 */}
      <div className="flex gap-3">
        <button
          onClick={undoMove}
          disabled={moveHistory.length === 0}
          className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 transition-all hover:bg-gray-700 disabled:opacity-30"
        >
          悔棋
        </button>
        <button
          onClick={() => resetGame()}
          className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 transition-all hover:bg-gray-700"
        >
          新局
        </button>
        <button
          onClick={analyze}
          disabled={loading || !isElectron}
          className="rounded-lg bg-amber-500 px-6 py-2 text-sm font-semibold text-gray-900 transition-all hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? '分析中...' : 'AI 分析'}
        </button>
        {aiHints.length > 0 && (
          <button
            onClick={clearHints}
            className="rounded-lg border border-gray-500 px-3 py-2 text-xs text-gray-400 hover:bg-gray-700"
          >
            清除提示
          </button>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="w-full max-w-xl rounded-lg border border-red-500/40 bg-red-900/20 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* AI 分析结果 */}
      {aiResult && (
        <div className="w-full max-w-xl rounded-lg border border-gray-700 bg-gray-900/60 p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-bold text-gray-300">
              AI 推荐 (depth={aiResult.moves[0]?.depth})
            </span>
            <span className="text-gray-600">红方视角分数</span>
          </div>
          <div className="space-y-1.5">
            {aiResult.moves.map((m: any) => (
              <div
                key={m.multipv}
                className="flex items-center gap-3 rounded border border-gray-700/50 px-2 py-1 font-mono"
              >
                <span className="font-bold text-amber-400">#{m.multipv}</span>
                <span className={m.score > 0 ? 'text-green-400' : m.score < 0 ? 'text-red-400' : 'text-gray-400'}>
                  {m.score > 0 ? '+' : ''}{m.score}
                </span>
                <span className="text-gray-300">{m.pv.slice(0, 4).join(' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FEN 调试 */}
      <details className="w-full max-w-xl">
        <summary className="cursor-pointer text-xs text-gray-600">FEN 字符串</summary>
        <code className="mt-1 block break-all rounded bg-gray-900 px-3 py-2 text-xs text-gray-500">
          {fen}
        </code>
      </details>
    </main>
  );
}
