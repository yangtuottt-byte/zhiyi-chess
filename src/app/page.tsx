'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChessGame, turnChar, DIFFICULTY_CONFIG } from '@/hooks/useChessGame';
import type { GameMode, AIDifficulty } from '@/hooks/useChessGame';
import { useElectron } from '@/hooks/useElectron';
import { useSaveManager } from '@/hooks/useSaveManager';
import { useSettings } from '@/hooks/useSettings';
import { uciToPositions } from '@/lib/uci';
import { boardToFen } from '@/lib/fen';
import { parseIccsToGameRecord } from '@/lib/pgnParser';
import { Side } from '@/core/types';
import type { SaveSlot } from '@/lib/storage';
import Chessboard from '@/components/Chessboard';
import ControlsPanel from '@/components/ControlsPanel';
import GameOverModal from '@/components/GameOverModal';
import HomeScreen from '@/components/HomeScreen';
import BoardEditor from '@/components/BoardEditor';
import GameLibrary from '@/components/GameLibrary';
import Toast from '@/components/Toast';
import SaveModal from '@/components/SaveModal';
import LoadModal from '@/components/LoadModal';
import PlaybackController from '@/components/PlaybackController';
import MoveList from '@/components/MoveList';

/** AI 请求超时 */
const AI_TIMEOUT_MS = 12_000;

/** 强制从 board 实时构建 FEN，含回合标记断言 */
function buildSyncedFen(
  board: ReturnType<typeof useChessGame>['board'],
  expectedTurn: 'w' | 'b'
): string {
  const side = expectedTurn === 'w' ? Side.Red : Side.Black;
  const fen = boardToFen(board, side);

  const marker = expectedTurn === 'w' ? ' w ' : ' b ';
  if (!fen.includes(marker)) {
    const msg = `❌ FEN回合标记断言失败！expected=${expectedTurn}  FEN=${fen}`;
    console.error(msg);
    throw new Error(msg);
  }
  return fen;
}

// ══════════════════════════════════════════════════════════════════

export default function Home() {
  // ── 视图路由 ─────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<'home' | 'game' | 'library' | 'editor'>('home');

  // ── Electron / 游戏状态 ──────────────────────────────────────
  const { isElectron, envChecked, analyzePosition, getEngineStatus } = useElectron();
  const game = useChessGame();
  const saveManager = useSaveManager();
  const { animDuration } = useSettings();

  // ── 页面级状态 ──────────────────────────────────────────────
  const [engineStatus, setEngineStatus] = useState('检测中...');
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  const lastCoachFenRef = useRef('');
  const autoMoveGuard = useRef(false);
  const coachHintGuard = useRef(false);
  const resignedRef = useRef(false);

  const playerTurnChar = turnChar(game.playerSide);
  const uciOpts = DIFFICULTY_CONFIG[game.aiDifficulty];
  const boardLocked =
    (game.gameMode !== 'practice' && game.currentTurn !== playerTurnChar) || game.isThinking;

  // ── 引擎初始化 ──────────────────────────────────────────────

  useEffect(() => {
    if (!envChecked) return;
    if (!isElectron) { setEngineStatus('浏览器模式'); return; }
    getEngineStatus()
      .then((s) => setEngineStatus(s.ready ? '引擎就绪' : '引擎未就绪'))
      .catch((e) => setEngineStatus('失败: ' + e.message));
  }, [envChecked, isElectron, getEngineStatus]);

  // ═══════════════════════════════════════════════════════════════
  // EFFECT A: AI 自动走棋 (coach + battle)
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (currentView !== 'game') return;
    if (game.gameMode === 'practice') return;
    // AI 走棋: 非玩家回合时自动走
    if (game.currentTurn === playerTurnChar) return;
    if (game.gameStatus !== 'playing') return;
    if (game.winner) return;
    if (!isElectron) return;
    if (autoMoveGuard.current) return;

    autoMoveGuard.current = true;
    game.setIsThinking(true);

    const timer = setTimeout(async () => {
      try {
        const syncedFen = buildSyncedFen(game.board, game.currentTurn);
        console.log('📡 [AI Auto-Move] 发起请求  FEN:', syncedFen);

        const result = await Promise.race([
          analyzePosition(syncedFen, uciOpts),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('引擎响应超时')), AI_TIMEOUT_MS)
          ),
        ]);

        console.log('✅ [AI Auto-Move] 响应:', JSON.stringify(result));

        if (!result?.moves?.length) throw new Error('引擎返回数据为空');
        const bestPv = result.moves[0]?.pv?.[0];
        if (!bestPv || bestPv.length < 4) throw new Error('PV 无效');

        const parsed = uciToPositions(bestPv);
        if (parsed) game.executeMove(parsed.from, parsed.to);
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
  }, [currentView, game.gameMode, game.currentTurn, game.gameStatus, game.fen, isElectron, playerTurnChar]);

  // ═══════════════════════════════════════════════════════════════
  // EFFECT B: AI 教学自动提示 (仅 coach)
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (currentView !== 'game') return;
    if (game.gameMode !== 'coach') return;
    // 仅在玩家回合时显示提示
    if (game.currentTurn !== playerTurnChar) return;
    if (game.gameStatus !== 'playing') return;
    if (game.winner) return;
    if (!isElectron) return;
    if (coachHintGuard.current) return;
    if (game.fen === lastCoachFenRef.current) return;

    coachHintGuard.current = true;

    let syncedFen: string;
    try {
      syncedFen = buildSyncedFen(game.board, game.currentTurn);
      lastCoachFenRef.current = syncedFen;
    } catch (e: any) {
      console.error('❌ [Coach Hint] FEN构建失败:', e);
      coachHintGuard.current = false;
      return;
    }

    console.log('📡 [Coach Hint] 发起请求  FEN:', syncedFen);

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await Promise.race([
          analyzePosition(syncedFen, uciOpts),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('引擎响应超时')), AI_TIMEOUT_MS)
          ),
        ]);
        if (cancelled) return;

        console.log('✅ [Coach Hint] 响应:', result?.moves?.length ?? 0, '条');

        if (!result?.moves?.length) { console.warn('⚠️ [Coach Hint] 空数据'); return; }

        setAiResult(result);
        game.setAIHints(
          result.moves.map((m: any) => {
            const p = uciToPositions(m.pv?.[0] ?? '');
            return {
              multipv: m.multipv ?? 0, from: p?.from ?? { row: 0, col: 0 },
              to: p?.to ?? { row: 0, col: 0 }, score: m.score ?? 0,
              depth: m.depth ?? 0, pv: m.pv ?? [],
            };
          })
        );
      } catch (e: any) {
        if (!cancelled) console.error('❌ [Coach Hint] 错误:', e);
      } finally {
        coachHintGuard.current = false;
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); coachHintGuard.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, game.gameMode, game.currentTurn, game.gameStatus, game.fen, isElectron, playerTurnChar]);

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

  // ── 手动 AI 分析 ────────────────────────────────────────────

  const analyze = useCallback(async () => {
    const syncedFen = buildSyncedFen(game.board, game.currentTurn);
    console.log('📡 [Manual] 发起请求  FEN:', syncedFen);
    setError(null); game.setIsThinking(true);
    try {
      const result = await Promise.race([
        analyzePosition(syncedFen, uciOpts),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('引擎响应超时')), AI_TIMEOUT_MS)
        ),
      ]);
      console.log('✅ [Manual] 响应:', result?.moves?.length ?? 0, '条');
      if (!result?.moves) throw new Error('引擎返回数据为空');
      setAiResult(result);
      game.setAIHints(
        result.moves.map((m: any) => {
          const p = uciToPositions(m.pv?.[0] ?? '');
          return {
            multipv: m.multipv ?? 0, from: p?.from ?? { row: 0, col: 0 },
            to: p?.to ?? { row: 0, col: 0 }, score: m.score ?? 0,
            depth: m.depth ?? 0, pv: m.pv ?? [],
          };
        })
      );
    } catch (e: any) {
      console.error('❌ [Manual] 错误:', e);
      setError(e.message);
    } finally {
      game.setIsThinking(false);
    }
  }, [game, analyzePosition]);

  // ── 开始游戏 (从 HomeScreen 进入) ────────────────────────────

  const handleStartGame = useCallback(
    (mode: GameMode, difficulty: AIDifficulty, playerSide: Side) => {
      console.log('[page] 开始游戏  mode:', mode, 'difficulty:', difficulty, 'playerSide:', playerSide);
      autoMoveGuard.current = false;
      coachHintGuard.current = false;
      lastCoachFenRef.current = '';
      resignedRef.current = false;
      setAiResult(null);
      setError(null);
      game.setPlayerSide(playerSide);
      game.setGameMode(mode);
      game.setAiDifficulty(difficulty);
      game.resetGame();
      setCurrentView('game');
    },
    [game]
  );

  // ── 返回主菜单 ─────────────────────────────────────────────

  const handleBackToHome = useCallback(() => {
    console.log('[page] 返回主菜单');
    autoMoveGuard.current = false;
    coachHintGuard.current = false;
    lastCoachFenRef.current = '';
    setAiResult(null);
    setError(null);
    game.setIsThinking(false);
    setCurrentView('home');
  }, [game]);

  // ── 棋谱大厅: 选中一局棋谱 ─────────────────────────────────
  //
  // 流程: ICCS 串 → pgnParser 推演为 FEN 历史 + moveRecords
  //       → game.loadGameRecord 装载状态 (强制 practice 模式, index=0)
  //       → 视图切换回 'game', 玩家可使用 PlaybackController 播放
  //
  // 推演被截断 (棋谱含非法/不可解析步) 时给出 Toast 提示, 但仍装载前缀部分.
  const handlePlayRecord = useCallback(
    (record: RecordWithMoves) => {
      console.log(`[page] 装载棋谱 #${record.id} "${record.event ?? ''}"`);
      const parsed = parseIccsToGameRecord(record.moves);

      if (parsed.movesParsed === 0) {
        setToast({ message: '棋谱解析失败: 走法串为空或全部非法', type: 'error' });
        return;
      }

      // 重置所有 AI 守卫, 防止 effect 在装载瞬间误触发
      autoMoveGuard.current = false;
      coachHintGuard.current = false;
      lastCoachFenRef.current = '';
      resignedRef.current = false;
      setAiResult(null);
      setError(null);

      game.loadGameRecord(
        parsed.fenHistory,
        parsed.moveRecords,
        {
          recordId: record.id,
          event: record.event,
          redPlayer: record.red_player,
          blackPlayer: record.black_player,
          redTeam: record.red_team,
          blackTeam: record.black_team,
          result: record.result,
          opening: record.opening,
        },
        // ★ parser 已用引用推演出 boardHistory, piece.id 全程稳定 — 直接交给 hook,
        //   省去重推 + 保证装载后做时光机也不会瞬移.
        parsed.boardHistory,
      );

      setCurrentView('game');

      // 推演不完整时, 提示用户但不阻塞 (已装载前缀部分)
      if (parsed.movesParsed < parsed.movesTotal) {
        setToast({
          message: `棋谱推演至第 ${parsed.movesParsed}/${parsed.movesTotal} 步遇到异常, 已加载前缀`,
          type: 'info',
        });
      } else {
        setToast({
          message: `已装载棋谱 · 共 ${parsed.movesParsed} 步, 点击 ▶ 开始复盘`,
          type: 'success',
        });
      }
    },
    [game]
  );

  // ── 新局 ────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    game.resetGame();
    autoMoveGuard.current = false;
    coachHintGuard.current = false;
    lastCoachFenRef.current = '';
    resignedRef.current = false;
    setAiResult(null);
    setError(null);
  }, [game]);

  // ── 棋盘编辑器: 挑战 AI ──────────────────────────────────────

  const handleChallengeFromEditor = useCallback(
    (fen: string) => {
      console.log('[page] 编辑器残局挑战 AI  FEN:', fen);
      autoMoveGuard.current = false;
      coachHintGuard.current = false;
      lastCoachFenRef.current = '';
      resignedRef.current = false;
      setAiResult(null);
      setError(null);
      game.setGameMode('battle');
      game.setAiDifficulty('medium');
      game.setPlayerSide(Side.Red);
      game.loadCustomFEN(fen);
      setCurrentView('game');
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

  const clearHints = useCallback(() => {
    game.setAIHints([]);
    setAiResult(null);
    lastCoachFenRef.current = '';
  }, [game]);

  // ── 对战交互 ───────────────────────────────────────────────

  const handleResign = useCallback(() => {
    resignedRef.current = true;
    game.resign();
  }, [game]);

  const handleDraw = useCallback(() => {
    const accepted = game.offerDraw();
    if (!accepted) {
      setToast({ message: '电脑拒绝求和', type: 'info' });
    }
  }, [game]);

  // ── 存档/读档 (多槽位) ─────────────────────────────────────

  const handleConfirmSave = useCallback((name: string) => {
    const slot: SaveSlot = {
      id: crypto.randomUUID(),
      name,
      timestamp: Date.now(),
      fen: game.fen,
      fenHistory: [...game.fenHistory],
      currentTurn: game.currentTurn,
      gameMode: game.gameMode,
      playerSide: game.playerSide,
      aiDifficulty: game.aiDifficulty,
    };
    saveManager.addSlot(slot);
    saveManager.closeSaveModal();
    setToast({ message: '对局已保存', type: 'success' });
  }, [game, saveManager]);

  const handleLoadSlot = useCallback((slot: SaveSlot) => {
    game.restoreFromSave({
      fen: slot.fen,
      fenHistory: slot.fenHistory,
      gameMode: slot.gameMode,
      playerSide: slot.playerSide,
      aiDifficulty: slot.aiDifficulty,
    });
    autoMoveGuard.current = false;
    coachHintGuard.current = false;
    lastCoachFenRef.current = '';
    resignedRef.current = false;
    setAiResult(null);
    setError(null);
    saveManager.closeLoadModal();
    setToast({ message: '读档成功', type: 'success' });
  }, [game, saveManager]);

  const handleDeleteSlot = useCallback((id: string) => {
    saveManager.removeSlot(id);
  }, [saveManager]);

  // ── GameOver 原因生成 ──────────────────────────────────────

  const getGameOverReason = (): string => {
    if (game.winner === 'draw') return '双方同意和棋';
    if (resignedRef.current) {
      const loser = game.winner === 'w' ? '黑方' : '红方';
      const victor = game.winner === 'w' ? '红方' : '黑方';
      return `${loser}认输，${victor}获胜`;
    }
    if (game.checkSide) {
      return `绝杀！${game.checkSide === 'w' ? '红方' : '黑方'}无路可逃`;
    }
    return '困毙！无子可走';
  };

  // ═══════════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════════

  if (currentView === 'home') {
    return (
      <HomeScreen
        onStartGame={handleStartGame}
        onOpenLibrary={() => setCurrentView('library')}
        onOpenEditor={() => setCurrentView('editor')}
      />
    );
  }

  if (currentView === 'editor') {
    return (
      <BoardEditor
        onChallengeAI={handleChallengeFromEditor}
        onBack={handleBackToHome}
      />
    );
  }

  if (currentView === 'library') {
    return (
      <GameLibrary
        onBack={() => setCurrentView('home')}
        onPlayRecord={handlePlayRecord}
      />
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-3 px-4 py-4">
      <h1 className="text-lg font-bold text-amber-400 tracking-widest">
        智弈
      </h1>

      {/* ── 棋谱元数据条 (仅当从棋谱大厅装载时显示) ── */}
      {game.recordMeta && (
        <div className="w-full max-w-[552px] rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-slate-400">
              {game.recordMeta.event ?? <span className="italic text-slate-600">未署赛事</span>}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-slate-600">
              #{game.recordMeta.recordId}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-red-300/90">
              红 · {game.recordMeta.redPlayer ?? '—'}
              {game.recordMeta.redTeam && (
                <span className="ml-1 text-[11px] text-slate-600">({game.recordMeta.redTeam})</span>
              )}
            </span>
            <span className="shrink-0 font-mono text-xs text-amber-400">
              {game.recordMeta.result ?? '?'}
            </span>
            <span className="truncate text-right text-slate-200">
              {game.recordMeta.blackPlayer ?? '—'} · 黑
              {game.recordMeta.blackTeam && (
                <span className="ml-1 text-[11px] text-slate-600">({game.recordMeta.blackTeam})</span>
              )}
            </span>
          </div>
        </div>
      )}

      <div className="relative rounded-xl bg-amber-950/20 p-3 shadow-2xl">
        <Chessboard
          board={game.board}
          selectedPos={game.selectedPos}
          legalMoves={game.legalMoves}
          aiHints={game.aiHints}
          currentSide={game.currentSide}
          onCellClick={game.handleCellClick}
          boardLocked={boardLocked}
          flipped={game.boardFlipped}
          lastMove={game.lastMove}
          lastCapture={game.lastCapture}
          checkSide={game.checkSide}
          animDuration={animDuration}
        />

        {game.winner && (
          <GameOverModal
            winner={game.winner}
            reason={getGameOverReason()}
            onNewGame={handleReset}
            onBackToHome={handleBackToHome}
          />
        )}
      </div>

      {/* ── 练习模式: 棋谱回看 ── */}
      {game.gameMode === 'practice' && (
        <div className="w-full max-w-[552px] space-y-3">
          <PlaybackController
            currentMoveIndex={game.currentMoveIndex}
            totalMoves={game.fenHistory.length - 1}
            isReviewing={game.isReviewing}
            onStart={game.goToStart}
            onBack={game.goBack}
            onForward={game.goForward}
            onEnd={game.goToEnd}
          />
          <MoveList
            fenHistory={game.fenHistory}
            moveRecords={game.moveRecords}
            currentMoveIndex={game.currentMoveIndex}
            onJump={game.jumpToMove}
          />
        </div>
      )}

      <ControlsPanel
        gameMode={game.gameMode}
        aiDifficulty={game.aiDifficulty}
        onSetAiDifficulty={game.setAiDifficulty}
        engineStatus={engineStatus}
        currentTurn={game.currentTurn}
        gameStatus={game.gameStatus}
        checkSide={game.checkSide}
        moveCount={game.fenHistory.length - 1}
        onUndo={handleUndo}
        onReset={handleReset}
        onBackToHome={handleBackToHome}
        canUndo={game.canUndo}
        onAnalyze={analyze}
        onClearHints={clearHints}
        aiThinking={game.isThinking}
        hasHints={game.aiHints.length > 0}
        isElectron={isElectron}
        aiResult={aiResult}
        error={error}
        onResign={handleResign}
        onDraw={handleDraw}
        onSave={saveManager.openSaveModal}
        onLoad={saveManager.openLoadModal}
      />

      {/* ── 存档模态框 ── */}
      {saveManager.showSaveModal && (
        <SaveModal
          onConfirm={handleConfirmSave}
          onCancel={saveManager.closeSaveModal}
        />
      )}

      {saveManager.showLoadModal && (
        <LoadModal
          slots={saveManager.slots}
          onLoad={handleLoadSlot}
          onDelete={handleDeleteSlot}
          onClose={saveManager.closeLoadModal}
        />
      )}

      <details className="w-full max-w-[552px]">
        <summary className="cursor-pointer text-xs text-gray-600">FEN</summary>
        <code className="mt-1 block break-all rounded bg-gray-900 px-3 py-2 text-xs text-gray-500">
          {game.fen}
        </code>
      </details>

      {/* Toast 通知 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}
