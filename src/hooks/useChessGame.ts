'use client';

import { useState, useCallback, useRef } from 'react';
import { Board, Piece, Position, Side } from '@/core/types';
import { getLegalMoves, isInCheck, isGameOver } from '@/core/rules';
import { fenToBoard, boardToFen } from '@/lib/fen';
import { audio } from '@/lib/audio';

const DEFAULT_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

// ─── 类型 ─────────────────────────────────────────────────────────

export type GameMode = 'practice' | 'coach' | 'battle';
export type GameStatus = 'playing' | 'check' | 'gameover';
export type Winner = 'w' | 'b' | 'draw';

export interface AIHint {
  multipv: number;
  from: Position;
  to: Position;
  score: number;
  depth: number;
  pv: string[];
}

export interface UseChessGameOptions {
  initialFen?: string;
}

export interface RestoreData {
  fen: string;
  fenHistory: string[];
  gameMode: GameMode;
  playerSide: Side;
  aiDepth: number;
}

export interface MoveRecord {
  from: Position;
  to: Position;
}

export interface UseChessGameReturn {
  // 核心状态
  board: Board;
  fen: string;
  currentSide: Side;
  currentTurn: 'w' | 'b';
  gameMode: GameMode;
  gameStatus: GameStatus;
  checkSide: 'w' | 'b' | null;
  winner: Winner | null;

  // 玩家设置
  playerSide: Side;
  boardFlipped: boolean;

  // AI
  aiHints: AIHint[];
  aiDepth: number;
  isThinking: boolean;

  // 交互
  selectedPos: Position | null;
  legalMoves: Position[];

  // 历史
  fenHistory: string[];
  canUndo: boolean;

  // 时光机
  currentMoveIndex: number;
  isReviewing: boolean;
  moveRecords: (MoveRecord | null)[];
  goToStart: () => void;
  goBack: () => void;
  goForward: () => void;
  goToEnd: () => void;
  jumpToMove: (index: number) => void;

  // 操作
  setGameMode: (mode: GameMode) => void;
  setAiDepth: (depth: number) => void;
  setIsThinking: (v: boolean) => void;
  setPlayerSide: (side: Side) => void;
  handleCellClick: (row: number, col: number) => void;
  undoMove: (steps?: number) => void;
  resetGame: () => void;
  setAIHints: (hints: AIHint[]) => void;

  // 对战交互
  resign: () => void;
  offerDraw: () => boolean;

  // 存档恢复
  restoreFromSave: (data: RestoreData) => void;

  /** 供 useEffect 驱动的 AI 自动落子调用 */
  executeMove: (from: Position, to: Position) => void;
}

// ─── 辅助 ─────────────────────────────────────────────────────────

function deriveStatus(board: Board, side: Side): GameStatus {
  const over = isGameOver(board, side);
  if (over) return 'gameover';
  if (isInCheck(board, side)) return 'check';
  return 'playing';
}

export function turnChar(side: Side): 'w' | 'b' {
  return side === Side.Red ? 'w' : 'b';
}

function flipSide(side: Side): Side {
  return side === Side.Red ? Side.Black : Side.Red;
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useChessGame(options?: UseChessGameOptions): UseChessGameReturn {
  const startFen = options?.initialFen || DEFAULT_FEN;

  // ── 核心状态 ─────────────────────────────────────────────────

  const [{ board, side: currentSide }, setGameState] = useState(() => {
    const { board, sideToMove } = fenToBoard(startFen);
    return { board, side: sideToMove };
  });

  const [fen, setFen] = useState(startFen);
  const [fenHistory, setFenHistory] = useState<string[]>([startFen]);
  const [gameMode, setGameModeState] = useState<GameMode>('practice');
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [aiDepth, setAiDepth] = useState(10);
  const [isThinking, setIsThinking] = useState(false);
  const [checkSide, setCheckSide] = useState<'w' | 'b' | null>(null);
  const [winner, setWinner] = useState<Winner | null>(null);

  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [legalMoves, setLegalMoves] = useState<Position[]>([]);
  const [aiHints, setAiHints] = useState<AIHint[]>([]);

  // 玩家阵营（默认执红）
  const [playerSide, setPlayerSideState] = useState<Side>(Side.Red);

  // 时光机
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [moveRecords, setMoveRecords] = useState<(MoveRecord | null)[]>([null]);

  // Refs — 始终保持最新值，避免闭包过期
  const boardRef = useRef(board);
  const sideRef = useRef(currentSide);
  const fenRef = useRef(fen);
  const fenHistoryRef = useRef(fenHistory);
  const gameModeRef = useRef(gameMode);
  const gameStatusRef = useRef(gameStatus);
  const isThinkingRef = useRef(isThinking);
  const winnerRef = useRef(winner);
  const playerSideRef = useRef(playerSide);
  const currentMoveIndexRef = useRef(currentMoveIndex);
  const moveRecordsRef = useRef(moveRecords);

  boardRef.current = board;
  sideRef.current = currentSide;
  fenRef.current = fen;
  fenHistoryRef.current = fenHistory;
  gameModeRef.current = gameMode;
  gameStatusRef.current = gameStatus;
  isThinkingRef.current = isThinking;
  winnerRef.current = winner;
  playerSideRef.current = playerSide;
  currentMoveIndexRef.current = currentMoveIndex;
  moveRecordsRef.current = moveRecords;

  // ── 模式切换 ─────────────────────────────────────────────────

  const setGameMode = useCallback((mode: GameMode) => {
    console.log('[hook] 切换模式 →', mode);
    setGameModeState(mode);
  }, []);

  // ── 阵营设置 ─────────────────────────────────────────────────

  const setPlayerSide = useCallback((side: Side) => {
    console.log('[hook] 玩家阵营 →', side);
    setPlayerSideState(side);
  }, []);

  // ── 位置恢复 (时光机核心) ──────────────────────────────────────

  const restorePosition = useCallback((index: number) => {
    const targetFen = fenHistoryRef.current[index];
    if (!targetFen) return;

    const { board: b, sideToMove: s } = fenToBoard(targetFen);

    boardRef.current = b;
    sideRef.current = s;
    fenRef.current = targetFen;

    setGameState({ board: b, side: s });
    setFen(targetFen);
    setCurrentMoveIndex(index);
    setGameStatus(deriveStatus(b, s));
    setSelectedPos(null);
    setLegalMoves([]);
    setCheckSide(isInCheck(b, s) ? turnChar(s) : null);

    // 检测此位置是否为终局
    if (isGameOver(b, s)) {
      const prev = flipSide(s);
      setWinner(turnChar(prev));
    } else {
      setWinner(null);
    }
  }, []);

  // ── 时光机导航 ────────────────────────────────────────────────

  const goToStart = useCallback(() => {
    if (currentMoveIndexRef.current === 0) return;
    restorePosition(0);
  }, [restorePosition]);

  const goBack = useCallback(() => {
    if (currentMoveIndexRef.current <= 0) return;
    restorePosition(currentMoveIndexRef.current - 1);
  }, [restorePosition]);

  const goForward = useCallback(() => {
    if (currentMoveIndexRef.current >= fenHistoryRef.current.length - 1) return;
    restorePosition(currentMoveIndexRef.current + 1);
  }, [restorePosition]);

  const goToEnd = useCallback(() => {
    const last = fenHistoryRef.current.length - 1;
    if (currentMoveIndexRef.current === last) return;
    restorePosition(last);
  }, [restorePosition]);

  const jumpToMove = useCallback((index: number) => {
    if (index < 0 || index >= fenHistoryRef.current.length) return;
    if (index === currentMoveIndexRef.current) return;
    restorePosition(index);
  }, [restorePosition]);

  // ── 内部走子引擎 ─────────────────────────────────────────────

  const applyMove = useCallback(
    (from: Position, to: Position, b: Board, s: Side) => {
      const newBoard = b.map((r) => [...r]);
      const captured = newBoard[to.row][to.col];
      newBoard[to.row][to.col] = newBoard[from.row][from.col];
      newBoard[from.row][from.col] = null;

      const nextSide = flipSide(s);
      const newFen = boardToFen(newBoard, nextSide);
      const status = deriveStatus(newBoard, nextSide);
      const result = isGameOver(newBoard, nextSide);
      const inCheck = isInCheck(newBoard, nextSide);

      console.log(
        `[hook] applyMove ${turnChar(s)}→${turnChar(nextSide)}  ` +
        `from=(${from.row},${from.col}) to=(${to.row},${to.col})  ` +
        `status=${status} result=${result ?? 'none'}  fen=${newFen}`
      );

      return { newBoard, nextSide, newFen, status, captured, result, inCheck };
    },
    []
  );

  // ── executeMove: 供外部 (AI 自动落子 / 玩家走子) 调用 ─────────

  const executeMove = useCallback(
    (from: Position, to: Position) => {
      const { newBoard, nextSide, newFen, status, result, inCheck, captured } = applyMove(
        from, to,
        boardRef.current,
        sideRef.current
      );

      // ★ 时光分支: 如正在回看历史，截断未来记录
      const cidx = currentMoveIndexRef.current;
      const fullHistory = fenHistoryRef.current;

      let newFenHistory: string[];
      let newMoveRecords: (MoveRecord | null)[];

      if (cidx < fullHistory.length - 1) {
        // 截断: 保留 [0..cidx]，丢弃未来
        newFenHistory = fullHistory.slice(0, cidx + 1);
        newMoveRecords = moveRecordsRef.current.slice(0, cidx + 1);
        console.log(`[hook] 时光分支截断: 丢弃步骤 ${cidx + 1}..${fullHistory.length - 1}`);
      } else {
        newFenHistory = fullHistory;
        newMoveRecords = moveRecordsRef.current;
      }

      // 追加新步
      newFenHistory = [...newFenHistory, newFen];
      newMoveRecords = [...newMoveRecords, { from, to }];

      const newIndex = newFenHistory.length - 1;

      boardRef.current = newBoard;
      sideRef.current = nextSide;
      fenRef.current = newFen;
      fenHistoryRef.current = newFenHistory;
      moveRecordsRef.current = newMoveRecords;
      currentMoveIndexRef.current = newIndex;

      setGameState({ board: newBoard, side: nextSide });
      setFen(newFen);
      setFenHistory(newFenHistory);
      setMoveRecords(newMoveRecords);
      setCurrentMoveIndex(newIndex);
      setGameStatus(status);
      setSelectedPos(null);
      setLegalMoves([]);
      setAiHints([]);

      if (captured) {
        audio.playCapture();
      } else {
        audio.playMove();
      }
      if (inCheck) {
        setTimeout(() => audio.playCheck(), 150);
      }
      if (result) {
        setTimeout(() => audio.playGameOver(), 300);
      }

      if (result) {
        setWinner(turnChar(flipSide(nextSide)));
      }
      setCheckSide(inCheck ? turnChar(nextSide) : null);
    },
    [applyMove]
  );

  // ── handleCellClick: 玩家点击 ──────────────────────────────────

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (isThinkingRef.current) {
        console.log('[hook] 点击被拦截: isThinking=true');
        return;
      }
      if (gameStatusRef.current === 'gameover' &&
          currentMoveIndexRef.current === fenHistoryRef.current.length - 1) {
        // 只在最后一步时拦截；回看历史时可自由选子
        return;
      }

      const currentBoard = boardRef.current;
      const side = sideRef.current;
      const clickedPiece = currentBoard[row]?.[col] ?? null;

      // 对战/教练模式下 AI 控制的阵营 → 拦截
      if (
        (gameModeRef.current === 'battle' ||
          gameModeRef.current === 'coach') &&
        side !== playerSideRef.current
      ) {
        console.log('[hook] 点击被拦截: 该阵营由AI控制');
        return;
      }

      if (selectedPos) {
        const isLegal = legalMoves.some(
          (m) => m.row === row && m.col === col
        );

        if (isLegal) {
          executeMove(selectedPos, { row, col });
          return;
        }

        if (clickedPiece && clickedPiece.side === side) {
          setSelectedPos({ row, col });
          setLegalMoves(getLegalMoves(currentBoard, row, col));
          return;
        }

        setSelectedPos(null);
        setLegalMoves([]);
        return;
      }

      if (clickedPiece && clickedPiece.side === side) {
        setSelectedPos({ row, col });
        setLegalMoves(getLegalMoves(currentBoard, row, col));
      }
    },
    [selectedPos, legalMoves, executeMove]
  );

  // ── undoMove ────────────────────────────────────────────────────

  const undoMove = useCallback(
    (steps: number = 1) => {
      const history = fenHistoryRef.current;
      if (history.length <= steps) return;

      const newHistory = history.slice(0, -steps);
      const newRecords = moveRecordsRef.current.slice(0, -steps);
      const restoreFen = newHistory[newHistory.length - 1];
      const { board: restoredBoard, sideToMove: restoredSide } = fenToBoard(restoreFen);

      console.log(`[hook] 悔棋 ${steps} 步 → side=${turnChar(restoredSide)}`);

      const newIndex = newHistory.length - 1;

      boardRef.current = restoredBoard;
      sideRef.current = restoredSide;
      fenRef.current = restoreFen;
      fenHistoryRef.current = newHistory;
      moveRecordsRef.current = newRecords;
      currentMoveIndexRef.current = newIndex;

      setGameState({ board: restoredBoard, side: restoredSide });
      setFen(restoreFen);
      setFenHistory(newHistory);
      setMoveRecords(newRecords);
      setCurrentMoveIndex(newIndex);
      setGameStatus(deriveStatus(restoredBoard, restoredSide));
      setSelectedPos(null);
      setLegalMoves([]);
      setAiHints([]);
      setCheckSide(null);
      setWinner(null);
    },
    []
  );

  // ── resetGame ───────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    const { board: b, sideToMove: s } = fenToBoard(startFen);

    console.log('[hook] resetGame → side=', turnChar(s));

    boardRef.current = b;
    sideRef.current = s;
    fenRef.current = startFen;
    fenHistoryRef.current = [startFen];
    moveRecordsRef.current = [null];
    currentMoveIndexRef.current = 0;

    setGameState({ board: b, side: s });
    setFen(startFen);
    setFenHistory([startFen]);
    setMoveRecords([null]);
    setCurrentMoveIndex(0);
    setGameStatus('playing');
    setSelectedPos(null);
    setLegalMoves([]);
    setAiHints([]);
    setIsThinking(false);
    setCheckSide(null);
    setWinner(null);
  }, [startFen]);

  // ── 认输 ──────────────────────────────────────────────────────

  const resign = useCallback(() => {
    if (gameStatusRef.current === 'gameover') return;
    const mode = gameModeRef.current;
    if (mode !== 'battle') return;

    const aiSide = playerSideRef.current === Side.Red ? Side.Black : Side.Red;
    const aiWinner = turnChar(aiSide);
    console.log('[hook] 认输 → 胜者:', aiWinner);
    setWinner(aiWinner);
    setGameStatus('gameover');
    audio.playGameOver();
  }, []);

  // ── 求和 ──────────────────────────────────────────────────────

  const offerDraw = useCallback((): boolean => {
    if (gameStatusRef.current === 'gameover') return false;
    const accepted = Math.random() < 0.8;
    console.log('[hook] 求和 →', accepted ? '同意' : '拒绝');
    if (accepted) {
      setWinner('draw');
      setGameStatus('gameover');
      setTimeout(() => audio.playGameOver(), 200);
    }
    return accepted;
  }, []);

  // ── 存档恢复 ──────────────────────────────────────────────────

  const restoreFromSave = useCallback((data: RestoreData) => {
    const { board: restoredBoard, sideToMove: restoredSide } = fenToBoard(data.fen);

    console.log('[hook] 读档恢复 → side=', turnChar(restoredSide));

    const lastIdx = data.fenHistory.length - 1;

    boardRef.current = restoredBoard;
    sideRef.current = restoredSide;
    fenRef.current = data.fen;
    fenHistoryRef.current = data.fenHistory;
    moveRecordsRef.current = new Array(data.fenHistory.length).fill(null);
    currentMoveIndexRef.current = lastIdx;

    setGameState({ board: restoredBoard, side: restoredSide });
    setFen(data.fen);
    setFenHistory(data.fenHistory);
    setMoveRecords(new Array(data.fenHistory.length).fill(null));
    setCurrentMoveIndex(lastIdx);
    setGameModeState(data.gameMode);
    setPlayerSideState(data.playerSide);
    setAiDepth(data.aiDepth);
    setGameStatus(deriveStatus(restoredBoard, restoredSide));
    setSelectedPos(null);
    setLegalMoves([]);
    setAiHints([]);
    setIsThinking(false);
    setCheckSide(null);
    setWinner(null);
  }, []);

  // ── AI 提示 ─────────────────────────────────────────────────────

  const setAIHints = useCallback((hints: AIHint[]) => {
    setAiHints(hints);
  }, []);

  // ── canUndo ─────────────────────────────────────────────────────

  const minHistory =
    gameMode === 'battle' || gameMode === 'coach' ? 2 : 1;
  const canUndo = fenHistory.length > minHistory;

  const isReviewing = currentMoveIndex < fenHistory.length - 1;

  return {
    board,
    fen,
    currentSide,
    currentTurn: turnChar(currentSide),
    gameMode,
    gameStatus,
    checkSide,
    winner,
    playerSide,
    boardFlipped: playerSide === Side.Black,
    aiHints,
    aiDepth,
    isThinking,
    selectedPos,
    legalMoves,
    fenHistory,
    canUndo,
    currentMoveIndex,
    isReviewing,
    moveRecords,
    goToStart,
    goBack,
    goForward,
    goToEnd,
    jumpToMove,
    setGameMode,
    setAiDepth,
    setIsThinking,
    setPlayerSide,
    handleCellClick,
    undoMove,
    resetGame,
    setAIHints,
    resign,
    offerDraw,
    restoreFromSave,
    executeMove,
  };
}
