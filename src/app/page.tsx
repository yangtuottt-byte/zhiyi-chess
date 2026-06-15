'use client';

import { useState, useCallback, useEffect } from 'react';
import { useChessGame } from '@/hooks/useChessGame';
import { useElectron } from '@/hooks/useElectron';
import { uciToPositions } from '@/lib/uci';
import Chessboard from '@/components/Chessboard';
import ControlsPanel from '@/components/ControlsPanel';

export default function Home() {
  const { isElectron, envChecked, analyzePosition, getEngineStatus } = useElectron();

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
      .catch((e) => setEngineStatus('失败: ' + e.message));
  }, [envChecked, isElectron, getEngineStatus]);

  // ── AI 分析 ─────────────────────────────────────────────────

  const analyze = useCallback(async () => {
    console.log('[page] AI分析触发, FEN:', fen);
    setLoading(true);
    setError(null);

    try {
      const res = await analyzePosition(fen);
      setAiResult(res);
      console.log('[page] AI结果:', res);

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
    } catch (e: any) {
      setError(e.message);
      console.error('[page] AI失败:', e);
    } finally {
      setLoading(false);
    }
  }, [fen, analyzePosition, setAIHints]);

  const clearHints = useCallback(() => {
    setAIHints([]);
    setAiResult(null);
  }, [setAIHints]);

  // ── 渲染 ─────────────────────────────────────────────────────

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 px-4 py-5">
      {/* 标题 */}
      <h1 className="text-xl font-bold text-amber-400 tracking-wide">
        AI象棋教练
      </h1>

      {/* 棋盘 */}
      <div className="rounded-xl bg-amber-950/20 p-3 shadow-2xl">
        <Chessboard
          board={board}
          selectedPos={selectedPos}
          legalMoves={legalMoves}
          aiHints={aiHints}
          currentSide={currentSide}
          onCellClick={handleCellClick}
        />
      </div>

      {/* 控制面板 (棋盘下方，互不遮挡) */}
      <ControlsPanel
        onUndo={undoMove}
        onReset={resetGame}
        canUndo={moveHistory.length > 0}
        moveCount={moveHistory.length}
        onAnalyze={analyze}
        onClearHints={clearHints}
        loading={loading}
        hasHints={aiHints.length > 0}
        isElectron={isElectron}
        engineStatus={engineStatus}
        currentSide={currentSide}
        isInCheck={isInCheckFlag}
        isCheckmated={isCheckmatedFlag}
        aiResult={aiResult}
        error={error}
      />

      {/* FEN 调试 (折叠) */}
      <details className="w-full max-w-[552px]">
        <summary className="cursor-pointer text-xs text-gray-600">
          FEN 字符串
        </summary>
        <code className="mt-1 block break-all rounded bg-gray-900 px-3 py-2 text-xs text-gray-500">
          {fen}
        </code>
      </details>
    </main>
  );
}
