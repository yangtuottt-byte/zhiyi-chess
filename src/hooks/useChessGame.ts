'use client';

import { useState, useCallback, useRef } from 'react';
import { Board, Piece, Position, Side, createInitialBoard } from '@/core/types';
import { getLegalMoves, getAllLegalMoves, isCheckmated, isInCheck } from '@/core/rules';
import { fenToBoard, boardToFen } from '@/lib/fen';

const DEFAULT_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

export interface AIHint {
  multipv: number;
  from: Position;
  to: Position;
  score: number;
  depth: number;
  pv: string[];
}

interface HistoryEntry {
  from: Position;
  to: Position;
  captured: Piece | null;
  prevFen: string;
  prevSide: Side;
}

export interface UseChessGameReturn {
  board: Board;
  fen: string;
  currentSide: Side;
  selectedPos: Position | null;
  legalMoves: Position[];
  moveHistory: HistoryEntry[];
  aiHints: AIHint[];
  isInCheckFlag: boolean;
  isCheckmatedFlag: boolean;

  /** 点击棋盘交叉点 */
  handleCellClick: (row: number, col: number) => void;
  /** 撤销上一步 */
  undoMove: () => void;
  /** 重置为初始布局 */
  resetGame: (fen?: string) => void;
  /** 设置 AI 推荐走法 */
  setAIHints: (hints: AIHint[]) => void;
}

export function useChessGame(initialFen?: string): UseChessGameReturn {
  const startFen = initialFen || DEFAULT_FEN;

  const [{ board, side: currentSide }, setGameState] = useState(() => {
    const { board, sideToMove } = fenToBoard(startFen);
    return { board, side: sideToMove };
  });

  const [fen, setFen] = useState(startFen);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [legalMoves, setLegalMoves] = useState<Position[]>([]);
  const [moveHistory, setMoveHistory] = useState<HistoryEntry[]>([]);
  const [aiHints, setAiHints] = useState<AIHint[]>([]);

  const fenRef = useRef(startFen);
  const boardRef = useRef(board);
  const sideRef = useRef(currentSide);

  boardRef.current = board;
  sideRef.current = currentSide;

  // ── 将军 / 将死检测 ──────────────────────────────────────────

  const [isInCheckFlag, setIsInCheck] = useState(false);
  const [isCheckmatedFlag, setIsCheckmated] = useState(false);

  const updateCheckStatus = useCallback((b: Board, s: Side) => {
    setIsInCheck(isInCheck(b, s));
    setIsCheckmated(isCheckmated(b, s));
  }, []);

  // ── 棋盘点击 ─────────────────────────────────────────────────

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      const clickedPiece = boardRef.current[row]?.[col] ?? null;

      // 情况 A: 已选中棋子，且点击的是合法落点 → 执行走子
      if (selectedPos) {
        const isLegalTarget = legalMoves.some(
          (m) => m.row === row && m.col === col
        );

        if (isLegalTarget) {
          // 执行走子
          const captured = boardRef.current[row][col];
          const prevFen = fenRef.current;

          const newBoard = boardRef.current.map((r) => [...r]);
          newBoard[row][col] = newBoard[selectedPos.row][selectedPos.col];
          newBoard[selectedPos.row][selectedPos.col] = null;

          const nextSide =
            currentSide === Side.Red ? Side.Black : Side.Red;
          const newFen = boardToFen(newBoard, nextSide);

          boardRef.current = newBoard;
          fenRef.current = newFen;

          setGameState({ board: newBoard, side: nextSide });
          setFen(newFen);
          setSelectedPos(null);
          setLegalMoves([]);
          setMoveHistory((prev) => [
            ...prev,
            { from: selectedPos, to: { row, col }, captured, prevFen, prevSide: currentSide },
          ]);
          updateCheckStatus(newBoard, nextSide);
          return;
        }

        // 点击己方另一枚棋子 → 切换选中
        if (clickedPiece && clickedPiece.side === currentSide) {
          setSelectedPos({ row, col });
          setLegalMoves(getLegalMoves(boardRef.current, row, col));
          return;
        }

        // 其他情况 → 取消选中
        setSelectedPos(null);
        setLegalMoves([]);
        return;
      }

      // 情况 B: 未选中棋子，点击己方棋子 → 选中
      if (clickedPiece && clickedPiece.side === currentSide) {
        setSelectedPos({ row, col });
        setLegalMoves(getLegalMoves(boardRef.current, row, col));
      }
    },
    [selectedPos, legalMoves, currentSide, updateCheckStatus]
  );

  // ── 撤销 ─────────────────────────────────────────────────────

  const undoMove = useCallback(() => {
    if (moveHistory.length === 0) return;

    const last = moveHistory[moveHistory.length - 1];
    const { board: prevBoard, sideToMove: prevSide } = fenToBoard(last.prevFen);

    boardRef.current = prevBoard;
    fenRef.current = last.prevFen;

    setGameState({ board: prevBoard, side: prevSide });
    setFen(last.prevFen);
    setSelectedPos(null);
    setLegalMoves([]);
    setMoveHistory((prev) => prev.slice(0, -1));
    updateCheckStatus(prevBoard, prevSide);
  }, [moveHistory, updateCheckStatus]);

  // ── 重置 ─────────────────────────────────────────────────────

  const resetGame = useCallback(
    (newFen?: string) => {
      const f = newFen || startFen;
      const { board: b, sideToMove: s } = fenToBoard(f);

      boardRef.current = b;
      fenRef.current = f;

      setGameState({ board: b, side: s });
      setFen(f);
      setSelectedPos(null);
      setLegalMoves([]);
      setMoveHistory([]);
      setIsInCheck(false);
      setIsCheckmated(false);
    },
    [startFen]
  );

  // ── AI 提示 ─────────────────────────────────────────────────

  const setAIHints = useCallback((hints: AIHint[]) => {
    setAiHints(hints);
  }, []);

  return {
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
  };
}
