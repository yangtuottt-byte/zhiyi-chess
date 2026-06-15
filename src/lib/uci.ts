import { Position } from '@/core/types';

/**
 * UCI 坐标 ↔ 前端二维数组坐标 转换工具。
 *
 * ── 坐标系差异 ──
 *
 *   UCI 标准:
 *     col: a=0 .. i=8 (9 列, 左→右)
 *     rank: 0=红方底线(下) .. 9=黑方底线(上)
 *
 *   前端 Board[row][col]:
 *     row: 0=黑方底线(上) .. 9=红方底线(下)
 *
 *   ★ 转换公式: frontendRow = 9 - uciRank
 *                  uciRank   = 9 - frontendRow
 *
 * ── 走法字符串格式 ──
 *   "h7g7" = from(col=h,rank=7) to(col=g,rank=7)
 *   引擎 h7 (UCI rank=7) → 前端 row = 9-7 = 2 (黑方阵地)
 */

/** UCI 走法 → from/to 坐标 (含 Y 轴翻转) */
export function uciToPositions(move: string): { from: Position; to: Position } | null {
  if (move.length < 4) return null;

  const fromCol = move.charCodeAt(0) - 'a'.charCodeAt(0);
  const fromRow = 9 - parseInt(move[1], 10);   // ★ Y轴翻转
  const toCol   = move.charCodeAt(2) - 'a'.charCodeAt(0);
  const toRow   = 9 - parseInt(move[3], 10);   // ★ Y轴翻转

  if (isNaN(fromRow) || isNaN(toRow)) return null;
  if (fromCol < 0 || fromCol > 8 || toCol < 0 || toCol > 8) return null;
  if (fromRow < 0 || fromRow > 9 || toRow < 0 || toRow > 9) return null;

  return {
    from: { row: fromRow, col: fromCol },
    to:   { row: toRow,   col: toCol },
  };
}

/** from/to 坐标 → UCI 走法 (含 Y 轴翻转) */
export function positionsToUci(from: Position, to: Position): string {
  const fc = String.fromCharCode('a'.charCodeAt(0) + from.col);
  const tc = String.fromCharCode('a'.charCodeAt(0) + to.col);
  return `${fc}${9 - from.row}${tc}${9 - to.row}`;  // ★ Y轴翻转
}

/** 列索引 → 文件字母 */
export function colToFile(col: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + col);
}
