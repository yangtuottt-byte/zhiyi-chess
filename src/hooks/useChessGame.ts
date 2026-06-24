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

  boardRef.current = board;
  sideRef.current = currentSide;
  fenRef.current = fen;
  fenHistoryRef.current = fenHistory;
  gameModeRef.current = gameMode;
  gameStatusRef.current = gameStatus;
  isThinkingRef.current = isThinking;
  winnerRef.current = winner;
  playerSideRef.current = playerSide;

  // ── 模式切换 (含重置) ─────────────────────────────────────────

  const setGameMode = useCallback((mode: GameMode) => {
    console.log('[hook] 切换模式 →', mode);
    setGameModeState(mode);
  }, []);

  // ── 阵营设置 ─────────────────────────────────────────────────

  const setPlayerSide = useCallback((side: Side) => {
    console.log('[hook] 玩家阵营 →', side);
    setPlayerSideState(side);
  }, []);

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

      boardRef.current = newBoard;
      sideRef.current = nextSide;
      fenRef.current = newFen;

      setGameState({ board: newBoard, side: nextSide });
      setFen(newFen);
      setFenHistory((prev) => [...prev, newFen]);
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
      if (gameStatusRef.current === 'gameover') return;

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
      const restoreFen = newHistory[newHistory.length - 1];

      const { board: restoredBoard, sideToMove: restoredSide } =
        fenToBoard(restoreFen);

      console.log(`[hook] 悔棋 ${steps} 步 → side=${turnChar(restoredSide)}`);

      boardRef.current = restoredBoard;
      sideRef.current = restoredSide;
      fenRef.current = restoreFen;
      fenHistoryRef.current = newHistory;

      setGameState({ board: restoredBoard, side: restoredSide });
      setFen(restoreFen);
      setFenHistory(newHistory);
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

    setGameState({ board: b, side: s });
    setFen(startFen);
    setFenHistory([startFen]);
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

    // AI 获胜 = 非玩家阵营
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
    // 80% 概率同意
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

    boardRef.current = restoredBoard;
    sideRef.current = restoredSide;
    fenRef.current = data.fen;
    fenHistoryRef.current = data.fenHistory;

    setGameState({ board: restoredBoard, side: restoredSide });
    setFen(data.fen);
    setFenHistory(data.fenHistory);
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
