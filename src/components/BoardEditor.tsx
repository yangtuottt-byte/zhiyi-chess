'use client';

import { useState, useCallback, useRef } from 'react';
import { Board, Piece, PieceType, Side, BOARD_ROWS, BOARD_COLS, createInitialBoard } from '@/core/types';
import { boardToFen, PIECE_CHAR } from '@/lib/fen';
import Toast from '@/components/Toast';

// ─── 棋盘布局常量 (与 Chessboard 保持一致) ─────────────────────────

const CELL = 60;
const PAD = 36;
const ROWS = 10;
const COLS = 9;
const BOARD_W = (COLS - 1) * CELL + 2 * PAD;
const BOARD_H = (ROWS - 1) * CELL + 2 * PAD;
const PIECE_R = 22;

function pt(row: number, col: number) {
  return { x: PAD + col * CELL, y: PAD + row * CELL };
}

// ─── 工具箱棋子顺序 ──────────────────────────────────────────────

const PIECE_TYPES: PieceType[] = [
  PieceType.King,
  PieceType.Advisor,
  PieceType.Elephant,
  PieceType.Horse,
  PieceType.Rook,
  PieceType.Cannon,
  PieceType.Pawn,
];

// ─── 棋子圆形 (复用 Chessboard 样式) ──────────────────────────────

function PieceToken({
  piece,
  isSelected,
  size,
}: {
  piece: Piece;
  isSelected?: boolean;
  size?: number;
}) {
  const r = size ?? PIECE_R;
  const isRed = piece.side === Side.Red;

  return (
    <div
      className="flex items-center justify-center rounded-full select-none"
      style={{
        width: r * 2,
        height: r * 2,
        background: isRed
          ? 'radial-gradient(circle at 35% 35%, #fca5a5, #dc2626 60%, #991b1b)'
          : 'radial-gradient(circle at 35% 35%, #6b7280, #1f2937 60%, #030712)',
        border: isSelected
          ? '3px solid #fbbf24'
          : isRed
            ? '2px solid #b91c1c'
            : '2px solid #111827',
        boxShadow: isSelected
          ? '0 0 18px rgba(251,191,36,0.9), 0 0 32px rgba(251,191,36,0.4), 0 4px 12px rgba(0,0,0,0.5)'
          : '0 2px 6px rgba(0,0,0,0.45)',
        transition: 'box-shadow 0.15s, border 0.15s',
        fontSize: r * 0.85,
        fontWeight: 700,
        color: isRed ? '#fef2f2' : '#e5e7eb',
        fontFamily: "'KaiTi','STKaiti','楷体',serif",
        cursor: 'pointer',
      }}
    >
      {PIECE_CHAR[piece.type][piece.side]}
    </div>
  );
}

// ─── 公开接口 ──────────────────────────────────────────────────────

export interface BoardEditorProps {
  onChallengeAI: (fen: string) => void;
  onBack: () => void;
}

// ─── 组件 ──────────────────────────────────────────────────────────

export default function BoardEditor({ onChallengeAI, onBack }: BoardEditorProps) {
  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [activeTool, setActiveTool] = useState<{ side: Side; type: PieceType } | 'eraser' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  const idSeqRef = useRef(0);

  const genId = useCallback((side: Side, type: PieceType): string => {
    idSeqRef.current += 1;
    return `${side}-${type}-${idSeqRef.current}`;
  }, []);

  // ── 棋盘格子点击 ─────────────────────────────────────────────

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!activeTool) return;

    setBoard((prev) => {
      const newBoard = prev.map((r) => [...r]);

      if (activeTool === 'eraser') {
        newBoard[row][col] = null;
      } else {
        const { side, type } = activeTool;
        newBoard[row][col] = { type, side, id: genId(side, type) };
      }

      return newBoard;
    });
  }, [activeTool, genId]);

  // ── 操作按钮 ─────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    const empty: Board = Array.from({ length: BOARD_ROWS }, () =>
      Array(BOARD_COLS).fill(null)
    );
    setBoard(empty);
    setActiveTool(null);
  }, []);

  const handleReset = useCallback(() => {
    setBoard(createInitialBoard());
    setActiveTool(null);
    idSeqRef.current = 0;
  }, []);

  const handleChallenge = useCallback(() => {
    let redKings = 0;
    let blackKings = 0;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const p = board[r][c];
        if (p && p.type === PieceType.King) {
          if (p.side === Side.Red) redKings++;
          else blackKings++;
        }
      }
    }

    if (redKings !== 1 || blackKings !== 1) {
      setToast({ message: '双方必须各有且仅有一个将/帅', type: 'error' });
      return;
    }

    const fen = boardToFen(board, Side.Red);
    onChallengeAI(fen);
  }, [board, onChallengeAI]);

  // ── 收集棋子列表 ─────────────────────────────────────────────

  const pieceList: { piece: Piece; row: number; col: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p) pieceList.push({ piece: p, row: r, col: c });
    }
  }

  // ── 渲染 ─────────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-6">
      {/* ── 顶部标题栏 ── */}
      <div className="mb-4 flex w-full max-w-[840px] items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 backdrop-blur-md transition-all hover:border-slate-500/40 hover:bg-white/[0.08] hover:text-slate-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回主菜单
        </button>

        <h1 className="text-xl font-bold tracking-widest text-amber-400">
          棋盘编辑器
        </h1>

        <div className="w-[100px]" />
      </div>

      {/* ── 主体: 棋盘 + 工具箱 ── */}
      <div className="flex gap-5 items-start">
        {/* ══════════════ 左侧: 棋盘 ══════════════ */}
        <div className="shrink-0 rounded-xl border border-white/10 bg-amber-950/10 p-2 shadow-2xl backdrop-blur-sm">
          <div className="relative select-none" style={{ width: BOARD_W, height: BOARD_H }}>
            <svg
              className="absolute inset-0"
              width={BOARD_W}
              height={BOARD_H}
              viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
            >
              <rect x={0} y={0} width={BOARD_W} height={BOARD_H} rx={8} fill="#f5deb3" />

              <rect
                x={PAD - 2} y={PAD - 2}
                width={(COLS - 1) * CELL + 4}
                height={(ROWS - 1) * CELL + 4}
                fill="none" stroke="#b45309" strokeWidth={3} rx={2}
              />

              {Array.from({ length: ROWS }, (_, r) => (
                <line
                  key={`h${r}`}
                  x1={PAD} y1={PAD + r * CELL}
                  x2={PAD + (COLS - 1) * CELL} y2={PAD + r * CELL}
                  stroke="#8b4513" strokeWidth={1.2}
                />
              ))}

              {[0, COLS - 1].map((c) => (
                <line
                  key={`v${c}`}
                  x1={PAD + c * CELL} y1={PAD}
                  x2={PAD + c * CELL} y2={PAD + (ROWS - 1) * CELL}
                  stroke="#8b4513" strokeWidth={1.2}
                />
              ))}
              {Array.from({ length: COLS - 2 }, (_, i) => i + 1).map((c) => (
                <g key={`v${c}`}>
                  <line
                    x1={PAD + c * CELL} y1={PAD}
                    x2={PAD + c * CELL} y2={PAD + 4 * CELL}
                    stroke="#8b4513" strokeWidth={1.2}
                  />
                  <line
                    x1={PAD + c * CELL} y1={PAD + 5 * CELL}
                    x2={PAD + c * CELL} y2={PAD + (ROWS - 1) * CELL}
                    stroke="#8b4513" strokeWidth={1.2}
                  />
                </g>
              ))}

              {/* 九宫斜线 */}
              {[
                [0, 3, 2, 5], [0, 5, 2, 3],
                [7, 3, 9, 5], [7, 5, 9, 3],
              ].map(([r1, c1, r2, c2], i) => (
                <line
                  key={`pal${i}`}
                  x1={PAD + c1 * CELL} y1={PAD + r1 * CELL}
                  x2={PAD + c2 * CELL} y2={PAD + r2 * CELL}
                  stroke="#8b4513" strokeWidth={0.8} strokeDasharray="4 3"
                />
              ))}

              {/* 楚河汉界 */}
              <text
                x={PAD + 4 * CELL}
                y={PAD + 4.5 * CELL}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={22}
                fontWeight={700}
                fill="#8b4513"
                fontFamily="'KaiTi','STKaiti','楷体',serif"
                letterSpacing={14}
              >
                楚河　　汉界
              </text>
            </svg>
            {pieceList.map(({ piece, row, col }) => {
              const { x, y } = pt(row, col);
              return (
                <div
                  key={piece.id}
                  className="absolute flex items-center justify-center pointer-events-none"
                  style={{
                    left: x - PIECE_R,
                    top: y - PIECE_R,
                    width: PIECE_R * 2,
                    height: PIECE_R * 2,
                    zIndex: 21,
                  }}
                >
                  <PieceToken piece={piece} />
                </div>
              );
            })}

            {/* 隐形点击区域 */}
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) => {
                const { x, y } = pt(r, c);
                return (
                  <div
                    key={`click-${r}-${c}`}
                    className="absolute rounded-full"
                    style={{
                      left: x - PIECE_R,
                      top: y - PIECE_R,
                      width: PIECE_R * 2,
                      height: PIECE_R * 2,
                      zIndex: 30,
                      cursor: activeTool ? 'pointer' : 'default',
                    }}
                    onClick={() => handleCellClick(r, c)}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* ══════════════ 右侧: 工具箱 ══════════════ */}
        <div className="flex flex-col gap-4 w-[240px] shrink-0">
          {/* 红方棋盒 */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] backdrop-blur-md px-4 py-3">
            <h3 className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-red-400/80">
              红方
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {PIECE_TYPES.map((type) => {
                const toolKey = `red-${type}`;
                const isActive =
                  activeTool !== null &&
                  activeTool !== 'eraser' &&
                  activeTool.side === Side.Red &&
                  activeTool.type === type;

                return (
                  <button
                    key={toolKey}
                    onClick={() => setActiveTool({ side: Side.Red, type })}
                    className={`flex items-center justify-center rounded-xl p-1 transition-all duration-200 ${
                      isActive
                        ? 'scale-110 ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950'
                        : 'hover:scale-105 hover:bg-red-500/[0.08]'
                    }`}
                    title={`红${PIECE_CHAR[type][Side.Red]}`}
                  >
                    <PieceToken
                      piece={{ type, side: Side.Red, id: toolKey }}
                      isSelected={isActive}
                      size={18}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 黑方棋盒 */}
          <div className="rounded-xl border border-gray-500/20 bg-gray-500/[0.03] backdrop-blur-md px-4 py-3">
            <h3 className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400/80">
              黑方
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {PIECE_TYPES.map((type) => {
                const toolKey = `black-${type}`;
                const isActive =
                  activeTool !== null &&
                  activeTool !== 'eraser' &&
                  activeTool.side === Side.Black &&
                  activeTool.type === type;

                return (
                  <button
                    key={toolKey}
                    onClick={() => setActiveTool({ side: Side.Black, type })}
                    className={`flex items-center justify-center rounded-xl p-1 transition-all duration-200 ${
                      isActive
                        ? 'scale-110 ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950'
                        : 'hover:scale-105 hover:bg-gray-500/[0.08]'
                    }`}
                    title={`黑${PIECE_CHAR[type][Side.Black]}`}
                  >
                    <PieceToken
                      piece={{ type, side: Side.Black, id: toolKey }}
                      isSelected={isActive}
                      size={18}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 橡皮擦 */}
          <button
            onClick={() => setActiveTool('eraser')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-all duration-200 ${
              activeTool === 'eraser'
                ? 'border-amber-500/50 bg-amber-500/10 ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950'
                : 'border-white/10 bg-white/5 backdrop-blur-md hover:border-red-500/30 hover:bg-white/[0.08]'
            }`}
          >
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span
              className={`text-sm font-medium ${
                activeTool === 'eraser' ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              橡皮擦
            </span>
          </button>

          {/* 分隔线 */}
          <div className="border-t border-white/10" />

          {/* 操作按钮 */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleClear}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-400 backdrop-blur-md transition-all hover:border-slate-500/40 hover:bg-white/[0.08] hover:text-slate-200"
            >
              🗑️ 清空棋盘
            </button>

            <button
              onClick={handleReset}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-400 backdrop-blur-md transition-all hover:border-slate-500/40 hover:bg-white/[0.08] hover:text-slate-200"
            >
              🔄 恢复默认开局
            </button>

            <button
              onClick={handleChallenge}
              className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-bold tracking-wider text-slate-900 shadow-lg shadow-amber-500/20 transition-all duration-300 hover:from-amber-400 hover:to-orange-500 hover:shadow-amber-500/40 active:scale-95"
            >
              <span className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative z-10">⚔️ 以此残局挑战 AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
