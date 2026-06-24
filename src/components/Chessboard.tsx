'use client';

import React from 'react';
import { Position, Piece, Side, PieceType } from '@/core/types';
import { PIECE_CHAR } from '@/lib/fen';

// ─── 布局常量 ──────────────────────────────────────────────────────

const CELL = 60;       // 交叉点间距
const PAD = 36;        // 棋盘边距
const ROWS = 10;
const COLS = 9;
const BOARD_W = (COLS - 1) * CELL + 2 * PAD;
const BOARD_H = (ROWS - 1) * CELL + 2 * PAD;
const PIECE_R = 22;    // 棋子半径
const DOT_R = 6;       // 合法落点绿点半径
const HINT_R = 20;     // AI 提示方块半径

/** 交叉点棋盘坐标 → 像素坐标 */
function pt(row: number, col: number) {
  return { x: PAD + col * CELL, y: PAD + row * CELL };
}

// ─── AI 提示颜色 ───────────────────────────────────────────────────

const HINT_STYLE = [
  { fill: 'rgba(34,197,94,0.28)',  stroke: '#22c55e' },
  { fill: 'rgba(234,179,8,0.28)',  stroke: '#eab308' },
  { fill: 'rgba(249,115,22,0.25)', stroke: '#f97316' },
];

// ─── 棋子圆形 ──────────────────────────────────────────────────────

function transition(dur: string) {
  return `left ${dur} cubic-bezier(0.25, 0.8, 0.25, 1), top ${dur} cubic-bezier(0.25, 0.8, 0.25, 1)`;
}

function PieceToken({
  piece,
  isSelected,
  flipped,
  inCheck,
}: {
  piece: Piece;
  isSelected: boolean;
  flipped?: boolean;
  inCheck?: boolean;
}) {
  const isRed = piece.side === Side.Red;

  return (
    <div
      className="flex items-center justify-center rounded-full select-none"
      style={{
        width: PIECE_R * 2,
        height: PIECE_R * 2,
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
          : inCheck
            ? '0 0 16px rgba(239,68,68,0.8), 0 0 28px rgba(239,68,68,0.4), 0 2px 6px rgba(0,0,0,0.45)'
            : '0 2px 6px rgba(0,0,0,0.45)',
        animation: inCheck ? 'checkPulse 0.6s ease-in-out infinite' : undefined,
        transition: 'box-shadow 0.15s, border 0.15s',
        fontSize: 22,
        fontWeight: 700,
        color: isRed ? '#fef2f2' : '#e5e7eb',
        fontFamily: "'KaiTi','STKaiti','楷体',serif",
        cursor: 'pointer',
        transform: flipped ? 'rotate(180deg)' : undefined,
      }}
    >
      {PIECE_CHAR[piece.type][piece.side]}
    </div>
  );
}

// ─── 公开接口 ──────────────────────────────────────────────────────

export interface AIHintDisplay {
  multipv: number;
  from: Position;
  to: Position;
}

export interface MoveHighlight {
  from: Position;
  to: Position;
}

export interface CaptureEffect {
  piece: Piece;
  pos: Position;
}

export interface ChessboardProps {
  board: (Piece | null)[][];
  selectedPos: Position | null;
  legalMoves: Position[];
  aiHints: AIHintDisplay[];
  currentSide: Side;
  onCellClick: (row: number, col: number) => void;
  boardLocked?: boolean;
  flipped?: boolean;
  /** 上一步走子起止点高亮 */
  lastMove?: MoveHighlight | null;
  /** 被吃棋子残影 */
  lastCapture?: CaptureEffect | null;
  /** 哪一方被将军 */
  checkSide?: 'w' | 'b' | null;
  /** 棋子动画时长 (CSS 时间字符串) */
  animDuration?: string;
}

// ─── 棋盘组件 ──────────────────────────────────────────────────────

export default function Chessboard({
  board,
  selectedPos,
  legalMoves,
  aiHints,
  currentSide,
  onCellClick,
  boardLocked = false,
  flipped = false,
  lastMove,
  lastCapture,
  checkSide,
  animDuration = '0.3s',
}: ChessboardProps) {
  const legalSet = new Set(legalMoves.map((m) => `${m.row},${m.col}`));

  // 收集全部棋子供独立渲染（带稳定 key）
  const pieceList: Array<{ piece: Piece; row: number; col: number }> = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r]?.[c];
      if (p) pieceList.push({ piece: p, row: r, col: c });
    }
  }

  return (
    <div
      className="relative select-none"
      style={{
        width: BOARD_W,
        height: BOARD_H,
        transform: flipped ? 'rotate(180deg)' : undefined,
      }}
    >
      {/* ══════════════ Layer 1: SVG 网格 ══════════════ */}
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
          <React.Fragment key={`v${c}`}>
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
          </React.Fragment>
        ))}

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
          transform={flipped ? `rotate(180, ${PAD + 4 * CELL}, ${PAD + 4.5 * CELL})` : undefined}
        >
          楚河　　汉界
        </text>

        {/* AI 提示箭头 */}
        {aiHints.map((hint, i) => {
          const from = pt(hint.from.row, hint.from.col);
          const to = pt(hint.to.row, hint.to.col);
          const style = HINT_STYLE[Math.min(hint.multipv - 1, 2)];
          const offset = 6 * hint.multipv;

          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return null;

          const ux = dx / len;
          const uy = dy / len;
          const sx = from.x + ux * (PIECE_R + 2);
          const sy = from.y + uy * (PIECE_R + 2);
          const ex = to.x - ux * (PIECE_R + 2);
          const ey = to.y - uy * (PIECE_R + 2);
          const px = -uy * offset;
          const py = ux * offset;

          return (
            <line
              key={`arrow-${i}`}
              x1={sx + px} y1={sy + py}
              x2={ex + px} y2={ey + py}
              stroke={style.stroke}
              strokeWidth={2.5}
              strokeOpacity={0.7}
            />
          );
        })}
      </svg>

      {/* ══════════════ Layer 2: 上一步高亮 ══════════════ */}
      {lastMove && (
        <>
          <div
            className="absolute rounded-lg pointer-events-none"
            style={{
              left: pt(lastMove.from.row, lastMove.from.col).x - PIECE_R,
              top: pt(lastMove.from.row, lastMove.from.col).y - PIECE_R,
              width: PIECE_R * 2,
              height: PIECE_R * 2,
              backgroundColor: 'rgba(250,204,21,0.25)',
              border: '2px solid rgba(250,204,21,0.45)',
              zIndex: 4,
            }}
          />
          <div
            className="absolute rounded-lg pointer-events-none"
            style={{
              left: pt(lastMove.to.row, lastMove.to.col).x - PIECE_R,
              top: pt(lastMove.to.row, lastMove.to.col).y - PIECE_R,
              width: PIECE_R * 2,
              height: PIECE_R * 2,
              backgroundColor: 'rgba(250,204,21,0.35)',
              border: '2px solid rgba(250,204,21,0.6)',
              zIndex: 4,
            }}
          />
        </>
      )}

      {/* ══════════════ Layer 3: AI 提示方块 ══════════════ */}
      {aiHints.map((hint, i) => {
        const style = HINT_STYLE[Math.min(hint.multipv - 1, 2)];
        return (
          <React.Fragment key={`hint-${i}`}>
            <div
              className="absolute rounded-lg pointer-events-none"
              style={{
                left: pt(hint.from.row, hint.from.col).x - HINT_R,
                top: pt(hint.from.row, hint.from.col).y - HINT_R,
                width: HINT_R * 2,
                height: HINT_R * 2,
                backgroundColor: style.fill,
                border: `1.5px solid ${style.stroke}`,
                zIndex: 5,
              }}
            />
            <div
              className="absolute rounded-lg pointer-events-none"
              style={{
                left: pt(hint.to.row, hint.to.col).x - HINT_R,
                top: pt(hint.to.row, hint.to.col).y - HINT_R,
                width: HINT_R * 2,
                height: HINT_R * 2,
                backgroundColor: style.fill,
                border: `1.5px solid ${style.stroke}`,
                zIndex: 5,
              }}
            />
          </React.Fragment>
        );
      })}

      {/* ══════════════ Layer 4: 合法落点指示 ══════════════ */}
      {legalMoves.map((m) => {
        const { x, y } = pt(m.row, m.col);
        const occupied = board[m.row]?.[m.col] !== null;
        return (
          <div
            key={`legal-${m.row}-${m.col}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: x - (occupied ? PIECE_R + 2 : DOT_R),
              top: y - (occupied ? PIECE_R + 2 : DOT_R),
              width: occupied ? (PIECE_R + 2) * 2 : DOT_R * 2,
              height: occupied ? (PIECE_R + 2) * 2 : DOT_R * 2,
              backgroundColor: occupied ? 'transparent' : 'rgba(34,197,94,0.65)',
              border: occupied ? '2.5px solid rgba(34,197,94,0.75)' : 'none',
              zIndex: 10,
            }}
          />
        );
      })}

      {/* ══════════════ Layer 5: 棋子 (独立渲染 + 丝滑过渡) ══════════════ */}
      {pieceList.map(({ piece, row, col }) => {
        const { x, y } = pt(row, col);
        const isSel = selectedPos?.row === row && selectedPos?.col === col;
        const isKingInCheck =
          checkSide !== null &&
          checkSide !== undefined &&
          piece.type === PieceType.King &&
          ((piece.side === Side.Red && checkSide === 'w') ||
           (piece.side === Side.Black && checkSide === 'b'));

        return (
          <div
            key={piece.id ?? `${row}-${col}`}
            className="absolute flex items-center justify-center"
            style={{
              left: x - PIECE_R,
              top: y - PIECE_R,
              width: PIECE_R * 2,
              height: PIECE_R * 2,
              zIndex: isSel ? 25 : 21,
              transition: transition(animDuration),
              pointerEvents: 'none',
            }}
          >
            <PieceToken
              piece={piece}
              isSelected={isSel}
              flipped={flipped}
              inCheck={isKingInCheck}
            />
          </div>
        );
      })}

      {/* ══════════════ Layer 6: 吃子残影 ══════════════ */}
      {lastCapture && (
        <div
          className="absolute flex items-center justify-center pointer-events-none animate-capture-fade"
          style={{
            left: pt(lastCapture.pos.row, lastCapture.pos.col).x - PIECE_R,
            top: pt(lastCapture.pos.row, lastCapture.pos.col).y - PIECE_R,
            width: PIECE_R * 2,
            height: PIECE_R * 2,
            zIndex: 23,
          }}
        >
          <PieceToken piece={lastCapture.piece} isSelected={false} flipped={flipped} />
        </div>
      )}

      {/* ══════════════ Layer 7: 隐形点击区域 ══════════════ */}
      {Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => {
          const { x, y } = pt(r, c);
          const piece = board[r]?.[c] ?? null;
          const isLegal = legalSet.has(`${r},${c}`);
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
                cursor: piece || isLegal ? 'pointer' : 'default',
              }}
              onClick={() => onCellClick(r, c)}
            />
          );
        })
      )}

      {/* ══════════════ 行棋方标签 ══════════════ */}
      <div
        className="absolute top-1 right-2 text-xs font-bold text-amber-800/70 z-30 pointer-events-none"
        style={{ transform: flipped ? 'rotate(180deg)' : undefined }}
      >
        {currentSide === Side.Red ? '红方走' : '黑方走'}
      </div>

      {/* ══════════════ AI 思考锁屏遮罩 ══════════════ */}
      {boardLocked && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-[1px]">
          <div className="rounded-lg bg-gray-900/90 px-6 py-3 text-sm font-bold text-amber-400 shadow-xl animate-pulse">
            AI 思考中...
          </div>
        </div>
      )}
    </div>
  );
}
