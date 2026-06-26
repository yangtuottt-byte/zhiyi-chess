/**
 * ICCS 走法字符串 → FEN 历史数组 的纯函数推演引擎.
 *
 * 输入: "h2e2 b9c7 h0g2 ..." (ICCS / UCI 格式, 空格分隔)
 * 输出: [开局FEN, 第1步FEN, 第2步FEN, ...]
 *
 * 设计要点:
 *  - 不依赖 React 状态, 可在任意环境调用 (服务端 / 测试 / 渲染层)
 *  - 复用 src/lib/uci.ts 的坐标转换 与 src/core/rules.ts 的合法走法判定
 *  - 出现不可解析 / 不合法走法时, console.warn 并提前返回已成功推演的前缀, 不抛出
 */

import type { Board, Position } from '@/core/types';
import { Side } from '@/core/types';
import { fenToBoard, boardToFen } from '@/lib/fen';
import { uciToPositions } from '@/lib/uci';
import { getLegalMoves } from '@/core/rules';

/** 中国象棋标准开局 FEN, 红先 (w). */
export const START_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

// ──────────────────────────────────────────────────────────────────────
//  内部: 在棋盘副本上落子, 返回新 board + 下一回合方
// ──────────────────────────────────────────────────────────────────────

function flipSide(side: Side): Side {
  return side === Side.Red ? Side.Black : Side.Red;
}

function applyMoveOnBoard(
  board: Board,
  side: Side,
  from: Position,
  to: Position
): { newBoard: Board; nextSide: Side } | null {
  const fromPiece = board[from.row]?.[from.col];
  if (!fromPiece) return null;
  if (fromPiece.side !== side) return null;

  // 通过规则引擎拿合法落点, 防御性校验 (含将帅照面 / 自送将 等)
  const legal = getLegalMoves(board, from.row, from.col);
  const ok = legal.some((p) => p.row === to.row && p.col === to.col);
  if (!ok) return null;

  const newBoard: Board = board.map((r) => [...r]);
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;

  return { newBoard, nextSide: flipSide(side) };
}

// ──────────────────────────────────────────────────────────────────────
//  公共 API
// ──────────────────────────────────────────────────────────────────────

/**
 * 把 ICCS 走法串推演为完整 FEN 历史数组.
 *
 * - 第 0 项必为 START_FEN
 * - 第 i 项为执行了第 i 步之后的局面 FEN
 * - 任一步失败时: console.warn + 立即返回已成功推演的前缀
 */
export function parseIccsToFenHistory(iccsMoves: string): string[] {
  const fenHistory: string[] = [START_FEN];

  const tokens = (iccsMoves ?? '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return fenHistory;

  let { board, sideToMove: side } = fenToBoard(START_FEN);

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const parsed = uciToPositions(tok);
    if (!parsed) {
      console.warn(
        `[pgnParser] 第 ${i + 1} 步无法解析坐标: "${tok}", 已截断到第 ${i} 步`
      );
      return fenHistory;
    }

    const stepped = applyMoveOnBoard(board, side, parsed.from, parsed.to);
    if (!stepped) {
      console.warn(
        `[pgnParser] 第 ${i + 1} 步 "${tok}" 不是合法走法 ` +
        `(${side} 从 (${parsed.from.row},${parsed.from.col}) 到 (${parsed.to.row},${parsed.to.col})), ` +
        `已截断到第 ${i} 步`
      );
      return fenHistory;
    }

    board = stepped.newBoard;
    side = stepped.nextSide;
    fenHistory.push(boardToFen(board, side));
  }

  return fenHistory;
}

/** 同时返回 fenHistory / boardHistory / 每一步的 from/to 记录, 供 MoveList 高亮使用. */
export interface ParsedRecord {
  fenHistory: string[];
  /**
   * 与 fenHistory 同长. 每个 board 都是从 START 位置开始, 通过移动 *同一个* 棋子对象引用
   * 推演而来 → piece.id 在整段历史中保持稳定, 直接喂给 React reconciliation 不会瞬移.
   */
  boardHistory: Board[];
  /** 与 fenHistory 同长, [0] 为 null (代表开局), [i] 为产生 fenHistory[i] 的那一步. */
  moveRecords: ({ from: Position; to: Position } | null)[];
  /** 成功推演的步数 (= moveRecords.length - 1) */
  movesParsed: number;
  /** 原始 token 总数 */
  movesTotal: number;
}

/**
 * 与 parseIccsToFenHistory 同样的推演逻辑, 但顺便返回每一步的 board / from/to 记录.
 * 推荐前端联动时使用这个: 既能装载 fenHistory, 又能让 MoveList / lastMove 高亮工作,
 * 同时 boardHistory 保证 piece.id 全程稳定 (修复"棋子瞬移" bug 必备).
 */
export function parseIccsToGameRecord(iccsMoves: string): ParsedRecord {
  const tokens = (iccsMoves ?? '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  // 初始局面: 唯一一次调用 fenToBoard 生成稳定 ID, 后续全部通过引用推演
  const { board: initialBoard } = fenToBoard(START_FEN);
  const fenHistory: string[] = [START_FEN];
  const boardHistory: Board[] = [initialBoard];
  const moveRecords: ({ from: Position; to: Position } | null)[] = [null];

  if (tokens.length === 0) {
    return { fenHistory, boardHistory, moveRecords, movesParsed: 0, movesTotal: 0 };
  }

  let board = initialBoard;
  let side: Side = fenToBoard(START_FEN).sideToMove;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const parsed = uciToPositions(tok);
    if (!parsed) {
      console.warn(
        `[pgnParser] 第 ${i + 1} 步无法解析坐标: "${tok}", 已截断到第 ${i} 步`
      );
      break;
    }
    const stepped = applyMoveOnBoard(board, side, parsed.from, parsed.to);
    if (!stepped) {
      console.warn(
        `[pgnParser] 第 ${i + 1} 步 "${tok}" 不是合法走法, 已截断到第 ${i} 步`
      );
      break;
    }
    board = stepped.newBoard;
    side = stepped.nextSide;
    fenHistory.push(boardToFen(board, side));
    boardHistory.push(board);
    moveRecords.push({ from: parsed.from, to: parsed.to });
  }

  return {
    fenHistory,
    boardHistory,
    moveRecords,
    movesParsed: fenHistory.length - 1,
    movesTotal: tokens.length,
  };
}
