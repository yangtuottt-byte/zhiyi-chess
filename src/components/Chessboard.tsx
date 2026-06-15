'use client';

import React from 'react';
import { Position, Piece, Side, PieceType } from '@/core/types';
import { PIECE_CHAR } from '@/lib/fen';
import { uciToPositions } from '@/lib/uci';

// ─── 布局常量 ──────────────────────────────────────────────────────

const CELL = 60;
const PAD = 36;
const BOARD_W = 8 * CELL + 2 * PAD;
const BOARD_H = 9 * CELL + 2 * PAD;
const PIECE_R = 22;
const DOT_R = 6;
const HINT_R = 20;

/** 交叉点像素坐标 */
function px(row: number, col: number): { x: number; y: number } {
  return { x: PAD + col * CELL, y: PAD + row * CELL };
}

// ─── AI 提示颜色 ────────────────────────────────────────────────

const HINT_COLORS = [
  { fill: 'rgba(34,197,94,0.25)', stroke: '#22c55e' },   // 最佳: 绿
  { fill: 'rgba(234,179,8,0.25)', stroke: '#eab308' },    // 次选: 黄
  { fill: 'rgba(249,115,22,0.22)', stroke: '#f97316' },   // 第三: 橙
];

// ─── 棋子组件 ──────────────────────────────────────────────────────

function PieceView({ piece, row, col, isSelected }: {
  piece: Piece;
  row: number;
  col: number;
  isSelected: boolean;
}) {
  const { x, y } = px(row, col);
  const isRed = piece.side === Side.Red;

  return (
    <div
      className="absolute flex items-center justify-center rounded-full select-none"
      style={{
        left: x - PIECE_R,
        top: y - PIECE_R,
        width: PIECE_R * 2,
        height: PIECE_R * 2,
        cursor: 'pointer',
        zIndex: 20,
        background: isRed
          ? 'radial-gradient(circle at 35% 35%, #fca5a5, #dc2626 60%, #991b1b)'
          : 'radial-gradient(circle at 35% 35%, #4b5563, #1f2937 60%, #030712)',
        border: isSelected
          ? '3px solid #fbbf24'
          : isRed
            ? '2px solid #7f1d1d'
            : '2px solid #111827',
        boxShadow: isSelected
          ? '0 0 12px rgba(251,191,36,0.7), 0 2px 6px rgba(0,0,0,0.5)'
          : '0 2px 4px rgba(0,0,0,0.4)',
        transition: 'box-shadow 0.15s, border 0.15s',
        fontSize: 22,
        fontWeight: 700,
        color: isRed ? '#fef2f2' : '#f3f4f6',
        fontFamily: "'KaiTi', 'STKaiti', '楷体', serif",
      }}
    >
      {PIECE_CHAR[piece.type][piece.side as Side]}
    </div>
  );
}

// ─── 棋盘组件 ──────────────────────────────────────────────────────

export interface ChessboardProps {
  board: (Piece | null)[][];
  selectedPos: Position | null;
  legalMoves: Position[];
  aiHints: { multipv: number; from: Position; to: Position }[];
  currentSide: Side;
  onCellClick: (row: number, col: number) => void;
}

export default function Chessboard({
  board,
  selectedPos,
  legalMoves,
  aiHints,
  currentSide,
  onCellClick,
}: ChessboardProps) {
  // 构建 legalMoves 集合用于快速查找
  const legalSet = new Set(legalMoves.map((m) => `${m.row},${m.col}`));

  // 构建 AI 提示集合：{ "fromRow,fromCol" → { to, multipv } }
  const hintMap = new Map<string, { to: Position; multipv: number }>();
  for (const h of aiHints) {
    const key = `${h.from.row},${h.from.col}`;
    if (!hintMap.has(key)) hintMap.set(key, { to: h.to, multipv: h.multipv });
  }
  const hintToSet = new Set(
    aiHints.map((h) => `${h.to.row},${h.to.col}`)
  );

  return (
    <div className="relative inline-block select-none">
      {/* ── SVG 网格层 ── */}
      <svg
        width={BOARD_W}
        height={BOARD_H}
        className="block"
        viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      >
        {/* 棋盘背景 */}
        <rect x={0} y={0} width={BOARD_W} height={BOARD_H} rx={8} fill="#f5deb3" />
        <rect
          x={PAD - 2} y={PAD - 2}
          width={8 * CELL + 4} height={9 * CELL + 4}
          fill="none" stroke="#b45309" strokeWidth={3} rx={2}
        />

        {/* 横线 ×10 */}
        {Array.from({ length: 10 }, (_, r) => (
          <line
            key={`h-${r}`}
            x1={PAD} y1={PAD + r * CELL}
            x2={PAD + 8 * CELL} y2={PAD + r * CELL}
            stroke="#8b4513" strokeWidth={1.2}
          />
        ))}

        {/* 竖线: 左右边界贯通，内部在楚河汉界处断开 */}
        {[0, 8].map((c) => (
          <line
            key={`v-${c}`}
            x1={PAD + c * CELL} y1={PAD}
            x2={PAD + c * CELL} y2={PAD + 9 * CELL}
            stroke="#8b4513" strokeWidth={1.2}
          />
        ))}
        {[1, 2, 3, 4, 5, 6, 7].map((c) => (
          <React.Fragment key={`v-${c}`}>
            <line
              x1={PAD + c * CELL} y1={PAD}
              x2={PAD + c * CELL} y2={PAD + 4 * CELL}
              stroke="#8b4513" strokeWidth={1.2}
            />
            <line
              x1={PAD + c * CELL} y1={PAD + 5 * CELL}
              x2={PAD + c * CELL} y2={PAD + 9 * CELL}
              stroke="#8b4513" strokeWidth={1.2}
            />
          </React.Fragment>
        ))}

        {/* 九宫格斜线 */}
        {[
          [0, 3, 2, 5],
          [0, 5, 2, 3],
          [7, 3, 9, 5],
          [7, 5, 9, 3],
        ].map(([r1, c1, r2, c2], i) => (
          <line
            key={`pal-${i}`}
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

        {/* ── AI 提示箭头 (SVG 层) ── */}
        {aiHints.map((hint, i) => {
          const from = px(hint.from.row, hint.from.col);
          const to = px(hint.to.row, hint.to.col);
          const color = HINT_COLORS[Math.min(hint.multipv - 1, 2)];
          const offset = 6 * hint.multipv; // 错开避免重叠

          // 计算箭头方向
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return null;

          const ux = dx / len;
          const uy = dy / len;

          // 从棋子边缘出发
          const sx = from.x + ux * (PIECE_R + 2);
          const sy = from.y + uy * (PIECE_R + 2);
          const ex = to.x - ux * (PIECE_R + 2);
          const ey = to.y - uy * (PIECE_R + 2);

          // 垂直方向偏移
          const px2 = -uy * offset;
          const py2 = ux * offset;

          return (
            <g key={`hint-arrow-${i}`}>
              <line
                x1={sx + px2} y1={sy + py2}
                x2={ex + px2} y2={ey + py2}
                stroke={color.stroke}
                strokeWidth={3}
                strokeOpacity={0.7}
                markerEnd={`url(#arrow-${hint.multipv})`}
              />
            </g>
          );
        })}

        {/* 箭头标记定义 */}
        <defs>
          {[1, 2, 3].map((n) => (
            <marker
              key={`arrow-marker-${n}`}
              id={`arrow-${n}`}
              viewBox="0 0 10 10"
              refX={8} refY={5}
              markerWidth={6} markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={HINT_COLORS[n - 1].stroke} />
            </marker>
          ))}
        </defs>
      </svg>

      {/* ── AI 提示高亮块 ── */}
      {aiHints.map((hint, i) => {
        const color = HINT_COLORS[Math.min(hint.multipv - 1, 2)];
        return (
          <React.Fragment key={`hint-${i}`}>
            <div
              className="absolute rounded-lg pointer-events-none"
              style={{
                left: px(hint.from.row, hint.from.col).x - HINT_R,
                top: px(hint.from.row, hint.from.col).y - HINT_R,
                width: HINT_R * 2,
                height: HINT_R * 2,
                backgroundColor: color.fill,
                border: `1.5px solid ${color.stroke}`,
                zIndex: 5,
              }}
            />
            <div
              className="absolute rounded-lg pointer-events-none"
              style={{
                left: px(hint.to.row, hint.to.col).x - HINT_R,
                top: px(hint.to.row, hint.to.col).y - HINT_R,
                width: HINT_R * 2,
                height: HINT_R * 2,
                backgroundColor: color.fill,
                border: `1.5px solid ${color.stroke}`,
                zIndex: 5,
              }}
            />
          </React.Fragment>
        );
      })}

      {/* ── 合法落点指示器 (绿点) ── */}
      {legalMoves.map((m) => {
        const { x, y } = px(m.row, m.col);
        const hasPiece = board[m.row]?.[m.col] !== null;
        return (
          <div
            key={`legal-${m.row}-${m.col}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: x - (hasPiece ? PIECE_R + 2 : DOT_R),
              top: y - (hasPiece ? PIECE_R + 2 : DOT_R),
              width: hasPiece ? (PIECE_R + 2) * 2 : DOT_R * 2,
              height: hasPiece ? (PIECE_R + 2) * 2 : DOT_R * 2,
              backgroundColor: hasPiece ? 'transparent' : 'rgba(34,197,94,0.65)',
              border: hasPiece ? '2.5px solid rgba(239,68,68,0.7)' : 'none',
              borderRadius: hasPiece ? '50%' : '50%',
              zIndex: 10,
            }}
          />
        );
      })}

      {/* ── 点击热区 + 棋子 ── */}
      {board.map((row, r) =>
        row.map((piece, c) => {
          const { x, y } = px(r, c);
          const isSelected =
            selectedPos?.row === r && selectedPos?.col === c;

          return (
            <div
              key={`cell-${r}-${c}`}
              className="absolute"
              style={{
                left: x - PIECE_R,
                top: y - PIECE_R,
                width: PIECE_R * 2,
                height: PIECE_R * 2,
                zIndex: piece ? 21 : 15,
                cursor: piece ? 'pointer' : (legalSet.has(`${r},${c}`) ? 'pointer' : 'default'),
              }}
              onClick={() => onCellClick(r, c)}
            >
              {piece && (
                <PieceView piece={piece} row={r} col={c} isSelected={isSelected} />
              )}
            </div>
          );
        })
      )}

      {/* ── 行棋方指示 ── */}
      <div className="absolute top-1 right-2 text-xs font-bold text-amber-800/70 z-30">
        {currentSide === Side.Red ? '红方行棋' : '黑方行棋'}
      </div>
    </div>
  );
}
