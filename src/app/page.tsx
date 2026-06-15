'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChessGame } from '@/hooks/useChessGame';
import type { GameMode } from '@/hooks/useChessGame';
import { useElectron } from '@/hooks/useElectron';
import { uciToPositions } from '@/lib/uci';
import { boardToFen } from '@/lib/fen';
import { Side } from '@/core/types';
import Chessboard from '@/components/Chessboard';
import ControlsPanel from '@/components/ControlsPanel';
import GameOverModal from '@/components/GameOverModal';

/** AI 请求超时 (毫秒) */
const AI_TIMEOUT_MS = 12_000;

/**
 * ★ 强制从 board 实时生成 FEN，并使用 expectedTurn 设定回合标记，
 * 彻底切断对 React 异步 state 快照的依赖。
 *
 * 返回前执行断言：FEN 的回合标记必须与 expectedTurn 一致，
 * 不一致则直接抛错拦截，绝不发给引擎。
 */
function buildSyncedFen(
  board: ReturnType<typeof useChessGame>['board'],
  expectedTurn: 'w' | 'b'
): string {
  const side = expectedTurn === 'w' ? Side.Red : Side.Black;
  const fen = boardToFen(board, side);

  // ★ 发车前最终断言：FEN 回合标记必须严格匹配 expectedTurn
  const expectedMarker = expectedTurn === 'w' ? ' w ' : ' b ';
  if (!fen.includes(expectedMarker)) {
    const msg =
      `❌ FEN回合标记断言失败！expected=${expectedTurn} 但生成FEN中未找到"${expectedMarker}"  FEN=${fen}`;
    console.error(msg);
    throw new Error(msg);
  }

  return fen;
}

// ══════════════════════════════════════════════════════════════════

export default function Home() {
  const { isElectron, envChecked, analyzePosition, getEngineStatus } =
    useElectron();

  const game = useChessGame();

  // ── 页面级状态 ────────────────────────────────────────────────
  const [engineStatus, setEngineStatus] = useState('检测中...');
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);

  const lastCoachFenRef = useRef('');
  const autoMoveGuard = useRef(false);
  const coachHintGuard = useRef(false);

  const boardLocked =
    (game.gameMode !== 'practice' && game.currentTurn === 'b') ||
    game.isThinking;

  // ── 引擎初始化 ──────────────────────────────────────────────

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

  // ═══════════════════════════════════════════════════════════════
  // EFFECT A: AI 自动走黑方
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (game.gameMode === 'practice') return;
    if (game.currentTurn !== 'b') return;
    if (game.gameStatus !== 'playing') return;
    if (game.winner) return;                     // 游戏已结束
    if (!isElectron) return;
    if (autoMoveGuard.current) return;

    autoMoveGuard.current = true;
    game.setIsThinking(true);

    const timer = setTimeout(async () => {
      try {
        // ★ 强制同步构建 FEN (黑方回合 = 'b')
        const syncedFen = buildSyncedFen(game.board, 'b');
        console.log('📡 [AI Auto-Move] 发起请求  syncedFEN:', syncedFen);

        const result = await Promise.race([
          analyzePosition(syncedFen),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('引擎响应超时')), AI_TIMEOUT_MS)
          ),
        ]);

        console.log('✅ [AI Auto-Move] 响应:', JSON.stringify(result));

        if (!result || !Array.isArray(result.moves) || result.moves.length === 0) {
          throw new Error('引擎返回数据为空');
        }

        const bestPv = result.moves[0]?.pv?.[0];
        if (!bestPv || bestPv.length < 4) {
          throw new Error('引擎返回的 PV 无效');
        }

        const parsed = uciToPositions(bestPv);
        if (!parsed) {
          throw new Error('无法解析 UCI 走法: ' + bestPv);
        }

        game.executeMove(parsed.from, parsed.to);
      } catch (e: any) {
        console.error('❌ [AI Auto-Move] 错误:', e);
        setError('AI 走子失败: ' + e.message);
      } finally {
        autoMoveGuard.current = false;
        game.setIsThinking(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      autoMoveGuard.current = false;
      game.setIsThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.gameMode, game.currentTurn, game.gameStatus, game.fen, isElectron, game.aiDepth]);

  // ═══════════════════════════════════════════════════════════════
  // EFFECT B: AI 教学自动提示
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (game.gameMode !== 'coach') return;
    if (game.currentTurn !== 'w') return;
    if (game.gameStatus !== 'playing') return;
    if (game.winner) return;                     // 游戏已结束
    if (!isElectron) return;
    if (coachHintGuard.current) return;
    if (game.fen === lastCoachFenRef.current) return;

    coachHintGuard.current = true;

    // ★ 强制同步构建 FEN (红方回合 = 'w')
    let syncedFen: string;
    try {
      syncedFen = buildSyncedFen(game.board, 'w');
      lastCoachFenRef.current = syncedFen;
    } catch (e: any) {
      console.error('❌ [Coach Hint] FEN构建失败:', e);
      coachHintGuard.current = false;
      return;
    }

    console.log('📡 [Coach Hint] 发起请求  syncedFEN:', syncedFen);

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const result = await Promise.race([
          analyzePosition(syncedFen),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('引擎响应超时')), AI_TIMEOUT_MS)
          ),
        ]);

        if (cancelled) return;

        console.log('✅ [Coach Hint] 响应:', result?.moves?.length ?? 0, '条推荐');

        if (!result || !Array.isArray(result.moves) || result.moves.length === 0) {
          console.warn('⚠️ [Coach Hint] 引擎返回空数据，跳过提示');
          return;
        }

        setAiResult(result);

        const hints = result.moves.map((m: any) => {
          const parsed = uciToPositions(m.pv?.[0] ?? '');
          return {
            multipv: m.multipv ?? 0,
            from: parsed?.from ?? { row: 0, col: 0 },
            to: parsed?.to ?? { row: 0, col: 0 },
            score: m.score ?? 0,
            depth: m.depth ?? 0,
            pv: m.pv ?? [],
          };
        });
        game.setAIHints(hints);
      } catch (e: any) {
        if (!cancelled) {
          console.error('❌ [Coach Hint] 错误:', e);
        }
      } finally {
        coachHintGuard.current = false;
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      coachHintGuard.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.gameMode, game.currentTurn, game.gameStatus, game.fen, isElectron]);

  // ═══════════════════════════════════════════════════════════════
  // EFFECT C: 对战模式强制清空提示
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (game.gameMode === 'battle') {
      game.setAIHints([]);
      setAiResult(null);
      lastCoachFenRef.current = '';
    }
  }, [game.gameMode, game]);

  // ── 手动 AI 分析 (仅练习模式) ──────────────────────────────

  const analyze = useCallback(async () => {
    // 强制同步构建 FEN
    const syncedFen = buildSyncedFen(game.board, game.currentTurn);
    console.log('📡 [Manual Analyze] 发起请求  syncedFEN:', syncedFen);

    setError(null);
    game.setIsThinking(true);

    try {
      const result = await Promise.race([
        analyzePosition(syncedFen),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('引擎响应超时')), AI_TIMEOUT_MS)
        ),
      ]);

      console.log('✅ [Manual Analyze] 响应:', result?.moves?.length ?? 0, '条');

      if (!result || !Array.isArray(result.moves)) {
        throw new Error('引擎返回数据为空');
      }

      setAiResult(result);

      const hints = result.moves.map((m: any) => {
        const parsed = uciToPositions(m.pv?.[0] ?? '');
        return {
          multipv: m.multipv ?? 0,
          from: parsed?.from ?? { row: 0, col: 0 },
          to: parsed?.to ?? { row: 0, col: 0 },
          score: m.score ?? 0,
          depth: m.depth ?? 0,
          pv: m.pv ?? [],
        };
      });
      game.setAIHints(hints);
    } catch (e: any) {
      console.error('❌ [Manual Analyze] 错误:', e);
      setError(e.message);
    } finally {
      game.setIsThinking(false);
    }
  }, [game, analyzePosition]);

  // ── 模式切换: 强制重置 ─────────────────────────────────────

  const handleSetGameMode = useCallback(
    (mode: GameMode) => {
      console.log('[page] 切换模式:', mode);
      autoMoveGuard.current = false;
      coachHintGuard.current = false;
      lastCoachFenRef.current = '';
      setAiResult(null);
      setError(null);
      game.setGameMode(mode);
      game.resetGame();
    },
    [game]
  );

  const handleUndo = useCallback(() => {
    const steps = game.gameMode === 'practice' ? 1 : 2;
    game.undoMove(steps);
    autoMoveGuard.current = false;
    coachHintGuard.current = false;
    lastCoachFenRef.current = '';
    setAiResult(null);
  }, [game]);

  const handleReset = useCallback(() => {
    game.resetGame();
    autoMoveGuard.current = false;
    coachHintGuard.current = false;
    lastCoachFenRef.current = '';
    setAiResult(null);
    setError(null);
  }, [game]);

  const clearHints = useCallback(() => {
    game.setAIHints([]);
    setAiResult(null);
    lastCoachFenRef.current = '';
  }, [game]);

  // ═══════════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════════

  return (
    <main className="flex min-h-screen flex-col items-center gap-3 px-4 py-4">
      <h1 className="text-lg font-bold text-amber-400 tracking-wide">
        AI象棋教练
      </h1>

      <div className="relative rounded-xl bg-amber-950/20 p-3 shadow-2xl">
        <Chessboard
          board={game.board}
          selectedPos={game.selectedPos}
          legalMoves={game.legalMoves}
          aiHints={game.aiHints}
          currentSide={game.currentSide}
          onCellClick={game.handleCellClick}
          boardLocked={boardLocked}
        />

        {/* 终局弹窗 */}
        {game.winner && (
          <GameOverModal
            winner={game.winner}
            reason={
              game.gameStatus === 'gameover'
                ? game.checkSide
                  ? `绝杀！${game.checkSide === 'w' ? '红方' : '黑方'}无路可逃`
                  : '困毙！无子可走'
                : '对局结束'
            }
            onNewGame={handleReset}
          />
        )}
      </div>

      <ControlsPanel
        gameMode={game.gameMode}
        onSetGameMode={handleSetGameMode}
        aiDepth={game.aiDepth}
        onSetAiDepth={game.setAiDepth}
        engineStatus={engineStatus}
        currentTurn={game.currentTurn}
        gameStatus={game.gameStatus}
        checkSide={game.checkSide}
        moveCount={game.fenHistory.length - 1}
        onUndo={handleUndo}
        onReset={handleReset}
        canUndo={game.canUndo}
        onAnalyze={analyze}
        onClearHints={clearHints}
        aiThinking={game.isThinking}
        hasHints={game.aiHints.length > 0}
        isElectron={isElectron}
        aiResult={aiResult}
        error={error}
      />

      <details className="w-full max-w-[552px]">
        <summary className="cursor-pointer text-xs text-gray-600">FEN</summary>
        <code className="mt-1 block break-all rounded bg-gray-900 px-3 py-2 text-xs text-gray-500">
          {game.fen}
        </code>
      </details>
    </main>
  );
}
