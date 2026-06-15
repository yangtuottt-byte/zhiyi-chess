import { Position } from '@/core/types';

/**
 * UCI 坐标工具。
 *
 * 中国象棋 UCI 坐标约定:
 *   col: a=0 .. i=8 (9 列)
 *   row: 0=黑方底线 .. 9=红方底线 (10 行)
 *
 * 走法字符串格式: "h2e2" (4 字符: 起始列+起始行+目标列+目标行)
 */

/** UCI 走法 → from/to 坐标 */
export function uciToPositions(move: string): { from: Position; to: Position } | null {
  if (move.length < 4) return null;

  const fromCol = move.charCodeAt(0) - 'a'.charCodeAt(0);
  const fromRow = parseInt(move[1], 10);
  const toCol = move.charCodeAt(2) - 'a'.charCodeAt(0);
  const toRow = parseInt(move[3], 10);

  if (isNaN(fromRow) || isNaN(toRow)) return null;
  if (fromCol < 0 || fromCol > 8 || toCol < 0 || toCol > 8) return null;

  return {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
  };
}

/** from/to 坐标 → UCI 走法 */
export function positionsToUci(from: Position, to: Position): string {
  const fc = String.fromCharCode('a'.charCodeAt(0) + from.col);
  const tc = String.fromCharCode('a'.charCodeAt(0) + to.col);
  return `${fc}${from.row}${tc}${to.row}`;
}

/** 列索引 → 文件字母 */
export function colToFile(col: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + col);
}
