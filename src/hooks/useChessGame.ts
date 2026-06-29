'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { Board, Piece, Position, Side } from '@/core/types';
import { getLegalMoves, isInCheck, isGameOver } from '@/core/rules';
import { fenToBoard, boardToFen } from '@/lib/fen';
import { positionsToUci } from '@/lib/uci';
import { audio } from '@/lib/audio';
import { recordResult } from '@/lib/stats';

const DEFAULT_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

// ─── boardHistory 推演辅助 ─────────────────────────────────────────
//
// ★ 核心不变量: piece.id 必须在整局游戏内保持稳定.
// ★ 实现手段:    *绝不* 在中间局面调用 fenToBoard (它按 scan 顺序重新派 id, 会洗牌).
//                只在初始局面调用一次 fenToBoard, 后续每一步都通过移动 *同一个* 棋子
//                对象引用来推演新 board → React reconciliation 用 piece.id 当 key 时
//                可以一一对应到 DOM 节点, 实现"哪个棋子动哪个" 的丝滑过渡.

/** 在 board 上施加一步 (from → to), 返回新 board. 棋子对象引用 (含 id) 原地搬到目标格. */
function applyMovePreservingId(board: Board, from: Position, to: Position): Board {
  const newBoard = board.map((r) => [...r]);
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  return newBoard;
}

/**
 * 仅在没有 moveRecords 的情形下使用 (旧存档恢复).
 * 通过对比相邻两个 FEN 的盘面差异, 反推出走子的 from/to, 然后在 *前一个 board* 上施加
 * 走子 → 既能复用 prev 的 piece.id, 又能拿到 next 局面.
 *
 * 检测规则 (覆盖普通走子 + 吃子):
 *   - from = 上一局有子 / 下一局变 null 的格
 *   - to   = 上一局空 / 下一局有子, 或上一局有敌方子 / 下一局变同方己方子的格
 *
 * 异常 (探测失败) 时回退到 fenToBoard, 仅这一帧 id 重置, 不会级联污染.
 */
function diffAndApply(prev: Board, nextFen: string): Board {
  const { board: next } = fenToBoard(nextFen);

  let from: Position | null = null;
  let to: Position | null = null;
  for (let r = 0; r < prev.length; r++) {
    for (let c = 0; c < (prev[r]?.length ?? 0); c++) {
      const a = prev[r][c];
      const b = next[r][c];
      if (a && !b) {
        from = { row: r, col: c };
      } else if (!a && b) {
        to = { row: r, col: c };
      } else if (a && b && (a.side !== b.side || a.type !== b.type)) {
        // 吃子: 该格上的子被另一方棋子替换
        to = { row: r, col: c };
      }
    }
  }

  if (!from || !to) {
    // FEN 不连续 (例如跳关回退 / 多步压缩) — 安全降级到 fenToBoard
    return next;
  }
  return applyMovePreservingId(prev, from, to);
}

/** 把整段 fenHistory 推演为 boardHistory. 优先使用 moveRecords (精确), 否则 FEN-diff. */
function reconstructBoardHistory(
  fenHistory: string[],
  moveRecords?: (MoveRecord | null)[],
): Board[] {
  if (fenHistory.length === 0) return [];

  const { board: seed } = fenToBoard(fenHistory[0]);
  const boards: Board[] = [seed];

  for (let i = 1; i < fenHistory.length; i++) {
    const prev = boards[i - 1];
    const rec = moveRecords?.[i];
    if (rec) {
      boards.push(applyMovePreservingId(prev, rec.from, rec.to));
    } else {
      boards.push(diffAndApply(prev, fenHistory[i]));
    }
  }
  return boards;
}

// ─── 类型 ─────────────────────────────────────────────────────────

export type GameMode = 'practice' | 'coach' | 'battle';
export type GameStatus = 'playing' | 'check' | 'gameover';
export type Winner = 'w' | 'b' | 'draw';
export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface UCIOptions {
  depth: number;
  movetime: number;
}

export const DIFFICULTY_CONFIG: Record<AIDifficulty, UCIOptions> = {
  easy: { depth: 2, movetime: 1000 },
  medium: { depth: 4, movetime: 1000 },
  hard: { depth: 8, movetime: 3000 },
};

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
  aiDifficulty: AIDifficulty;
}

/** 棋谱元数据 — 用于在 UI 上展示真实选手 / 赛事名 */
export interface GameRecordMeta {
  recordId?: number;
  event?: string | null;
  redPlayer?: string | null;
  blackPlayer?: string | null;
  redTeam?: string | null;
  blackTeam?: string | null;
  result?: string | null;
  opening?: string | null;
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
  aiDifficulty: AIDifficulty;
  isThinking: boolean;

  // 交互
  selectedPos: Position | null;
  legalMoves: Position[];

  // 历史
  fenHistory: string[];
  iccsMoveHistory: string[];
  canUndo: boolean;

  // 时光机
  currentMoveIndex: number;
  isReviewing: boolean;
  moveRecords: (MoveRecord | null)[];
  lastMove: MoveRecord | null;
  lastCapture: { piece: Piece; pos: Position } | null;
  goToStart: () => void;
  goBack: () => void;
  goForward: () => void;
  goToEnd: () => void;
  jumpToMove: (index: number) => void;

  // 操作
  setGameMode: (mode: GameMode) => void;
  setAiDifficulty: (d: AIDifficulty) => void;
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

  /** 从自定义 FEN 加载残局 (供棋盘编辑器调用) */
  loadCustomFEN: (fen: string) => void;

  // 棋谱装载 (来自数据库 ICCS 推演结果)
  recordMeta: GameRecordMeta | null;
  loadGameRecord: (
    fenHistory: string[],
    moveRecords?: (MoveRecord | null)[],
    metaData?: GameRecordMeta,
    boardHistory?: Board[],
  ) => void;

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
  // ★ boardHistory: 与 fenHistory 同长, 每个 board 都通过引用推演而来,
  //   保证 piece.id 在整局内稳定 (修复"棋子瞬移"的核心).
  const [boardHistory, setBoardHistory] = useState<Board[]>(() => {
    const { board } = fenToBoard(startFen);
    return [board];
  });
  const [gameMode, setGameModeState] = useState<GameMode>('practice');
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [aiDifficulty, setAiDifficultyState] = useState<AIDifficulty>('medium');
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

  // 视觉反馈
  const [lastCapture, setLastCapture] = useState<{ piece: Piece; pos: Position } | null>(null);

  // 棋谱元数据
  const [recordMeta, setRecordMeta] = useState<GameRecordMeta | null>(null);

  // Refs — 始终保持最新值，避免闭包过期
  const boardRef = useRef(board);
  const sideRef = useRef(currentSide);
  const fenRef = useRef(fen);
  const fenHistoryRef = useRef(fenHistory);
  const boardHistoryRef = useRef(boardHistory);
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
  boardHistoryRef.current = boardHistory;
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

  const setAiDifficulty = useCallback((d: AIDifficulty) => {
    console.log('[hook] AI 难度 →', d, DIFFICULTY_CONFIG[d]);
    setAiDifficultyState(d);
  }, []);

  // ── 阵营设置 ─────────────────────────────────────────────────

  const setPlayerSide = useCallback((side: Side) => {
    console.log('[hook] 玩家阵营 →', side);
    setPlayerSideState(side);
  }, []);

  // ── 位置恢复 (时光机核心) ──────────────────────────────────────
  //
  // ★ 关键修复: 直接从 boardHistoryRef 读取已推演好的 board (含稳定 piece.id),
  //   *不再* 调用 fenToBoard(targetFen) — 后者会按 scan 顺序重新派 id, 导致两个
  //   同类同色棋子的 React key 互换, 触发"瞬移"动画 bug.
  //   sideToMove 仍通过 FEN 解析 (轻量, 与 id 无关).

  const restorePosition = useCallback((index: number) => {
    const targetFen = fenHistoryRef.current[index];
    const targetBoard = boardHistoryRef.current[index];
    if (!targetFen || !targetBoard) return;

    // 仅用 FEN 拿 sideToMove, 不取 board (避免 id 重派)
    const s: Side = targetFen.split(' ')[1] === 'b' ? Side.Black : Side.Red;

    boardRef.current = targetBoard;
    sideRef.current = s;
    fenRef.current = targetFen;

    setGameState({ board: targetBoard, side: s });
    setFen(targetFen);
    setCurrentMoveIndex(index);
    setGameStatus(deriveStatus(targetBoard, s));
    setSelectedPos(null);
    setLegalMoves([]);
    setCheckSide(isInCheck(targetBoard, s) ? turnChar(s) : null);

    // 检测此位置是否为终局
    if (isGameOver(targetBoard, s)) {
      const prev = flipSide(s);
      setWinner(turnChar(prev));
    } else {
      setWinner(null);
    }
    setLastCapture(null);
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
      let newBoardHistory: Board[];
      let newMoveRecords: (MoveRecord | null)[];

      if (cidx < fullHistory.length - 1) {
        // 截断: 保留 [0..cidx]，丢弃未来 (boardHistory 同步截断, 保持 id 链不断)
        newFenHistory = fullHistory.slice(0, cidx + 1);
        newBoardHistory = boardHistoryRef.current.slice(0, cidx + 1);
        newMoveRecords = moveRecordsRef.current.slice(0, cidx + 1);
        console.log(`[hook] 时光分支截断: 丢弃步骤 ${cidx + 1}..${fullHistory.length - 1}`);
      } else {
        newFenHistory = fullHistory;
        newBoardHistory = boardHistoryRef.current;
        newMoveRecords = moveRecordsRef.current;
      }

      // 追加新步 (newBoard 由 applyMove 通过引用搬运得到, piece.id 已保留)
      newFenHistory = [...newFenHistory, newFen];
      newBoardHistory = [...newBoardHistory, newBoard];
      newMoveRecords = [...newMoveRecords, { from, to }];

      const newIndex = newFenHistory.length - 1;

      boardRef.current = newBoard;
      sideRef.current = nextSide;
      fenRef.current = newFen;
      fenHistoryRef.current = newFenHistory;
      boardHistoryRef.current = newBoardHistory;
      moveRecordsRef.current = newMoveRecords;
      currentMoveIndexRef.current = newIndex;

      setGameState({ board: newBoard, side: nextSide });
      setFen(newFen);
      setFenHistory(newFenHistory);
      setBoardHistory(newBoardHistory);
      setMoveRecords(newMoveRecords);
      setCurrentMoveIndex(newIndex);
      setGameStatus(status);
      setSelectedPos(null);
      setLegalMoves([]);
      setAiHints([]);

      if (captured) {
        audio.playCapture();
        setLastCapture({ piece: captured, pos: to });
        setTimeout(() => setLastCapture(null), 400);
      } else {
        audio.playMove();
      }
      if (inCheck) {
        setTimeout(() => audio.playCheck(), 150);
      }
      if (result) {
        const victor = turnChar(flipSide(nextSide));
        const isPlayerWin = victor === turnChar(playerSideRef.current);
        setTimeout(() => audio.playGameOver(isPlayerWin ? 'win' : 'lose'), 300);
        setWinner(victor);
        if (gameModeRef.current === 'battle') {
          recordResult(isPlayerWin ? 'win' : 'lose');
        }
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
      const newBoards = boardHistoryRef.current.slice(0, -steps);
      const newRecords = moveRecordsRef.current.slice(0, -steps);
      const restoreFen = newHistory[newHistory.length - 1];
      const restoredBoard = newBoards[newBoards.length - 1];
      // sideToMove 从 FEN 解析即可, board 直接使用截断后的 boardHistory 末尾 (id 不变)
      const restoredSide: Side =
        restoreFen.split(' ')[1] === 'b' ? Side.Black : Side.Red;

      console.log(`[hook] 悔棋 ${steps} 步 → side=${turnChar(restoredSide)}`);

      const newIndex = newHistory.length - 1;

      boardRef.current = restoredBoard;
      sideRef.current = restoredSide;
      fenRef.current = restoreFen;
      fenHistoryRef.current = newHistory;
      boardHistoryRef.current = newBoards;
      moveRecordsRef.current = newRecords;
      currentMoveIndexRef.current = newIndex;

      setGameState({ board: restoredBoard, side: restoredSide });
      setFen(restoreFen);
      setFenHistory(newHistory);
      setBoardHistory(newBoards);
      setMoveRecords(newRecords);
      setCurrentMoveIndex(newIndex);
      setGameStatus(deriveStatus(restoredBoard, restoredSide));
      setSelectedPos(null);
      setLegalMoves([]);
      setAiHints([]);
      setCheckSide(null);
      setWinner(null);
      setLastCapture(null);
    },
    []
  );

  // ── resetGame ───────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    // ★ 重置 = 新的一局, 重新派发一套全新的 piece.id, 这是合理的边界
    const { board: b, sideToMove: s } = fenToBoard(startFen);

    console.log('[hook] resetGame → side=', turnChar(s));

    boardRef.current = b;
    sideRef.current = s;
    fenRef.current = startFen;
    fenHistoryRef.current = [startFen];
    boardHistoryRef.current = [b];
    moveRecordsRef.current = [null];
    currentMoveIndexRef.current = 0;

    setGameState({ board: b, side: s });
    setFen(startFen);
    setFenHistory([startFen]);
    setBoardHistory([b]);
    setMoveRecords([null]);
    setCurrentMoveIndex(0);
    setGameStatus('playing');
    setSelectedPos(null);
    setLegalMoves([]);
    setAiHints([]);
    setIsThinking(false);
    setCheckSide(null);
    setWinner(null);
    setLastCapture(null);
    setRecordMeta(null);
  }, [startFen]);

  // ── 自定义 FEN 加载 (棋盘编辑器入口) ───────────────────────────

  const loadCustomFEN = useCallback((fenStr: string) => {
    const { board: b, sideToMove: s } = fenToBoard(fenStr);

    console.log('[hook] loadCustomFEN → side=', turnChar(s), 'fen=', fenStr);

    boardRef.current = b;
    sideRef.current = s;
    fenRef.current = fenStr;
    fenHistoryRef.current = [fenStr];
    boardHistoryRef.current = [b];
    moveRecordsRef.current = [null];
    currentMoveIndexRef.current = 0;

    setGameState({ board: b, side: s });
    setFen(fenStr);
    setFenHistory([fenStr]);
    setBoardHistory([b]);
    setMoveRecords([null]);
    setCurrentMoveIndex(0);
    setGameStatus(deriveStatus(b, s));
    setSelectedPos(null);
    setLegalMoves([]);
    setAiHints([]);
    setIsThinking(false);
    setCheckSide(null);
    setWinner(null);
    setLastCapture(null);
    setRecordMeta(null);
  }, []);

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
    audio.playGameOver('lose');
    recordResult('lose');
  }, []);

  // ── 求和 ──────────────────────────────────────────────────────

  const offerDraw = useCallback((): boolean => {
    if (gameStatusRef.current === 'gameover') return false;
    const accepted = Math.random() < 0.8;
    console.log('[hook] 求和 →', accepted ? '同意' : '拒绝');
    if (accepted) {
      setWinner('draw');
      setGameStatus('gameover');
      setTimeout(() => audio.playGameOver('draw'), 200);
      recordResult('draw');
    }
    return accepted;
  }, []);

  // ── 存档恢复 ──────────────────────────────────────────────────

  const restoreFromSave = useCallback((data: RestoreData) => {
    // ★ 旧存档只保存了 fenHistory, 没有 moveRecords. 通过 FEN-diff 逐步反推 from/to,
    //   把 piece.id 沿历史一路传递下来 — 这样读档后再做悔棋 / 跳步, 仍然不会瞬移.
    const reconstructed = reconstructBoardHistory(data.fenHistory);
    const lastIdx = data.fenHistory.length - 1;
    const restoredBoard = reconstructed[lastIdx];
    const restoredSide: Side =
      data.fen.split(' ')[1] === 'b' ? Side.Black : Side.Red;

    console.log('[hook] 读档恢复 → side=', turnChar(restoredSide),
      ` (重建 boardHistory ${reconstructed.length} 帧)`);

    boardRef.current = restoredBoard;
    sideRef.current = restoredSide;
    fenRef.current = data.fen;
    fenHistoryRef.current = data.fenHistory;
    boardHistoryRef.current = reconstructed;
    moveRecordsRef.current = new Array(data.fenHistory.length).fill(null);
    currentMoveIndexRef.current = lastIdx;

    setGameState({ board: restoredBoard, side: restoredSide });
    setFen(data.fen);
    setFenHistory(data.fenHistory);
    setBoardHistory(reconstructed);
    setMoveRecords(new Array(data.fenHistory.length).fill(null));
    setCurrentMoveIndex(lastIdx);
    setGameModeState(data.gameMode);
    setPlayerSideState(data.playerSide);
    setAiDifficultyState(data.aiDifficulty);
    setGameStatus(deriveStatus(restoredBoard, restoredSide));
    setSelectedPos(null);
    setLegalMoves([]);
    setAiHints([]);
    setIsThinking(false);
    setCheckSide(null);
    setWinner(null);
    setLastCapture(null);
    setRecordMeta(null);
  }, []);

  // ── 棋谱装载 (来自数据库, 已被 pgnParser 推演) ─────────────────
  //
  // ★ 棋谱大厅装载流程: pgnParser 内部已经用引用推演了一遍 boardHistory,
  //   优先把它传进来 (零成本, id 完整). 兼容旧调用 (未传 boardHistory): 通过
  //   moveRecords 在 hook 内部重新推演, 退而求其次用 FEN-diff.

  const loadGameRecord = useCallback(
    (
      fenHistoryArg: string[],
      moveRecordsArg?: (MoveRecord | null)[],
      metaData?: GameRecordMeta,
      boardHistoryArg?: Board[],
    ) => {
      if (!fenHistoryArg || fenHistoryArg.length === 0) {
        console.warn('[hook] loadGameRecord 收到空 fenHistory, 已忽略');
        return;
      }

      // 首帧 = 开局, 进入打谱模式后玩家自己点"下一步"播放
      const targetIndex = 0;
      const targetFen = fenHistoryArg[targetIndex];

      // moveRecords 长度需与 fenHistory 对齐; 缺失则填 null
      const records: (MoveRecord | null)[] =
        moveRecordsArg && moveRecordsArg.length === fenHistoryArg.length
          ? moveRecordsArg.slice()
          : new Array(fenHistoryArg.length).fill(null);

      // boardHistory 来源优先级:
      //   1. 调用方直接传入 (parser 已推演) — 完美保留 id
      //   2. 通过 moveRecords 在 hook 内重推 — id 也稳定
      //   3. 仅 fenHistory 可用 — FEN-diff 反推 (兼容路径)
      const boards: Board[] =
        boardHistoryArg && boardHistoryArg.length === fenHistoryArg.length
          ? boardHistoryArg
          : reconstructBoardHistory(fenHistoryArg, records);

      const b = boards[targetIndex];
      const s: Side = targetFen.split(' ')[1] === 'b' ? Side.Black : Side.Red;

      console.log(
        `[hook] loadGameRecord → ${fenHistoryArg.length - 1} 步, ` +
        `boardHistory 源=${boardHistoryArg ? 'parser' : (moveRecordsArg ? 'records' : 'fen-diff')}, ` +
        `meta=${metaData ? `${metaData.redPlayer ?? '?'} vs ${metaData.blackPlayer ?? '?'}` : 'none'}`
      );

      boardRef.current = b;
      sideRef.current = s;
      fenRef.current = targetFen;
      fenHistoryRef.current = fenHistoryArg;
      boardHistoryRef.current = boards;
      moveRecordsRef.current = records;
      currentMoveIndexRef.current = targetIndex;
      gameModeRef.current = 'practice';

      setGameState({ board: b, side: s });
      setFen(targetFen);
      setFenHistory(fenHistoryArg);
      setBoardHistory(boards);
      setMoveRecords(records);
      setCurrentMoveIndex(targetIndex);
      setGameModeState('practice'); // 强制打谱模式
      setGameStatus(deriveStatus(b, s));
      setSelectedPos(null);
      setLegalMoves([]);
      setAiHints([]);
      setIsThinking(false);
      setCheckSide(null);
      setWinner(null);
      setLastCapture(null);
      setRecordMeta(metaData ?? null);
    },
    []
  );

  // ── AI 提示 ─────────────────────────────────────────────────────

  const setAIHints = useCallback((hints: AIHint[]) => {
    setAiHints(hints);
  }, []);

  // ── canUndo ─────────────────────────────────────────────────────

  const minHistory =
    gameMode === 'battle' || gameMode === 'coach' ? 2 : 1;
  const canUndo = fenHistory.length > minHistory;

  const isReviewing = currentMoveIndex < fenHistory.length - 1;

  const iccsMoveHistory = useMemo(
    () =>
      moveRecords
        .filter((r): r is MoveRecord => r !== null)
        .map((r) => positionsToUci(r.from, r.to)),
    [moveRecords]
  );

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
    aiDifficulty,
    isThinking,
    selectedPos,
    legalMoves,
    fenHistory,
    iccsMoveHistory,
    canUndo,
    currentMoveIndex,
    isReviewing,
    moveRecords,
    lastMove: currentMoveIndex > 0 ? (moveRecords[currentMoveIndex] ?? null) : null,
    lastCapture,
    goToStart,
    goBack,
    goForward,
    goToEnd,
    jumpToMove,
    setGameMode,
    setAiDifficulty,
    setIsThinking,
    setPlayerSide,
    handleCellClick,
    undoMove,
    resetGame,
    setAIHints,
    resign,
    offerDraw,
    restoreFromSave,
    loadCustomFEN,
    recordMeta,
    loadGameRecord,
    executeMove,
  };
}
