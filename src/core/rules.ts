import {
  Board,
  Piece,
  PieceType,
  Position,
  Side,
  BOARD_ROWS,
  BOARD_COLS,
  RIVER_RED_SIDE,
  PALACE,
} from './types';

// ─── helpers ───────────────────────────────────────────────────────

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

function inPalace(row: number, col: number, side: Side): boolean {
  const p = PALACE[side];
  return row >= p.rowMin && row <= p.rowMax && col >= p.colMin && col <= p.colMax;
}

function enemy(side: Side): Side {
  return side === Side.Red ? Side.Black : Side.Red;
}

function isRedSide(row: number): boolean {
  return row >= RIVER_RED_SIDE;
}

function cloneBoard(board: Board): Board {
  return board.map(r => [...r]);
}

// ─── 将帅照面检测 ──────────────────────────────────────────────────

/**
 * 检测当前局面是否存在"将帅照面"（飞公 / 白脸将）。
 * 规则：双方将/帅在同一条竖线上，且之间没有任何棋子阻挡。
 * 若当前方走子后导致己方将帅被照面，则该着法非法。
 */
function isFlyingGeneral(board: Board): boolean {
  const kings: Position[] = [];

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const p = board[r][c];
      if (p && p.type === PieceType.King) {
        kings.push({ row: r, col: c });
      }
    }
  }

  if (kings.length !== 2) return false; // 不应出现，防御性处理

  const [k0, k1] = kings;

  // 不在同一列则不可能照面
  if (k0.col !== k1.col) return false;

  // 检查同列之间是否有棋子阻挡
  const minRow = Math.min(k0.row, k1.row);
  const maxRow = Math.max(k0.row, k1.row);
  for (let r = minRow + 1; r < maxRow; r++) {
    if (board[r][k0.col] !== null) return false; // 有棋子阻挡，不照面
  }

  return true; // 同列且无阻挡 → 照面违规
}

// ─── 单步着法生成（不含照面过滤）──────────────────────────────────

/** 将/帅：九宫内横竖各一步 */
function kingMoves(board: Board, pos: Position, side: Side): Position[] {
  const results: Position[] = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    const nr = pos.row + dr;
    const nc = pos.col + dc;
    if (!inBounds(nr, nc)) continue;
    if (!inPalace(nr, nc, side)) continue;
    const target = board[nr][nc];
    if (target && target.side === side) continue; // 不能吃己方
    results.push({ row: nr, col: nc });
  }

  return results;
}

/** 士/仕：九宫内斜走一步 */
function advisorMoves(board: Board, pos: Position, side: Side): Position[] {
  const results: Position[] = [];
  const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  for (const [dr, dc] of dirs) {
    const nr = pos.row + dr;
    const nc = pos.col + dc;
    if (!inBounds(nr, nc)) continue;
    if (!inPalace(nr, nc, side)) continue;
    const target = board[nr][nc];
    if (target && target.side === side) continue;
    results.push({ row: nr, col: nc });
  }

  return results;
}

/** 象/相：走"田"字，不可过河，塞象眼时不能走 */
function elephantMoves(board: Board, pos: Position, side: Side): Position[] {
  const results: Position[] = [];

  // 田字：对角线两格
  // eye 为象眼坐标（田字中心），target 为目标落点
  const moves: [number, number, number, number][] = [
    [-1, -1, -2, -2], // 左上
    [-1,  1, -2,  2], // 右上
    [ 1, -1,  2, -2], // 左下
    [ 1,  1,  2,  2], // 右下
  ];

  for (const [deR, deC, dtR, dtC] of moves) {
    const eyeR = pos.row + deR;
    const eyeC = pos.col + deC;
    const targetR = pos.row + dtR;
    const targetC = pos.col + dtC;

    if (!inBounds(targetR, targetC)) continue;

    // 绝对不可过河
    if (side === Side.Red && targetR < RIVER_RED_SIDE) continue;
    if (side === Side.Black && targetR >= RIVER_RED_SIDE) continue;

    // 塞象眼：田字中心有棋子则不能走
    if (board[eyeR][eyeC] !== null) continue;

    const target = board[targetR][targetC];
    if (target && target.side === side) continue;

    results.push({ row: targetR, col: targetC });
  }

  return results;
}

/** 马：走"日"字，蹩马腿时对应方向不能走 */
function horseMoves(board: Board, pos: Position, side: Side): Position[] {
  const results: Position[] = [];

  // 每个条目: [腿的行偏移, 腿的列偏移, 目标行偏移, 目标列偏移]
  // 马走日 = 先沿轴向一格（腿），再斜向一格到目标
  const moves: [number, number, number, number][] = [
    [-1,  0, -2, -1], // 向上 → 左上
    [-1,  0, -2,  1], // 向上 → 右上
    [ 1,  0,  2, -1], // 向下 → 左下
    [ 1,  0,  2,  1], // 向下 → 右下
    [ 0, -1, -1, -2], // 向左 → 左上
    [ 0, -1,  1, -2], // 向左 → 左下
    [ 0,  1, -1,  2], // 向右 → 右上
    [ 0,  1,  1,  2], // 向右 → 右下
  ];

  for (const [legR, legC, dtR, dtC] of moves) {
    const legPosR = pos.row + legR;
    const legPosC = pos.col + legC;

    if (!inBounds(legPosR, legPosC)) continue;

    // 蹩马腿：腿位有棋子则此方向不能走
    if (board[legPosR][legPosC] !== null) continue;

    const targetR = pos.row + dtR;
    const targetC = pos.col + dtC;

    if (!inBounds(targetR, targetC)) continue;

    const target = board[targetR][targetC];
    if (target && target.side === side) continue;

    results.push({ row: targetR, col: targetC });
  }

  return results;
}

/** 车：横竖直线，无步数限制，不可越子 */
function rookMoves(board: Board, pos: Position, side: Side): Position[] {
  const results: Position[] = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    let nr = pos.row + dr;
    let nc = pos.col + dc;

    while (inBounds(nr, nc)) {
      const target = board[nr][nc];

      if (target === null) {
        // 空位，可走
        results.push({ row: nr, col: nc });
      } else {
        // 有棋子：敌方可吃，己方停止
        if (target.side !== side) {
          results.push({ row: nr, col: nc });
        }
        break; // 撞子后停止
      }

      nr += dr;
      nc += dc;
    }
  }

  return results;
}

/**
 * 炮：移动规则与车相同（不可越子）。
 * 但吃子时必须隔一个子（炮架）—— 即炮与目标之间恰好有 1 个棋子。
 */
function cannonMoves(board: Board, pos: Position, side: Side): Position[] {
  const results: Position[] = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    let nr = pos.row + dr;
    let nc = pos.col + dc;

    // 第一阶段：纯移动（不吃子），与车相同
    while (inBounds(nr, nc) && board[nr][nc] === null) {
      results.push({ row: nr, col: nc });
      nr += dr;
      nc += dc;
    }

    // 撞到第一个棋子 — 此位置不可落子，往后寻找炮架吃子
    if (!inBounds(nr, nc)) continue;
    // 跳过这个棋子（潜在的炮架）
    nr += dr;
    nc += dc;

    // 第二阶段：寻找第一个可吃的敌方棋子（隔山打牛）
    while (inBounds(nr, nc)) {
      const target = board[nr][nc];
      if (target !== null) {
        // 找到炮架后的第一个棋子，敌方可吃，己方不能吃（不能隔子吃己方）
        if (target.side !== side) {
          results.push({ row: nr, col: nc });
        }
        break; // 隔一个炮架后只关注第一个棋子
      }
      nr += dr;
      nc += dc;
    }
  }

  return results;
}

/** 兵/卒：未过河只能向前，过河可前左右，绝不后退 */
function pawnMoves(board: Board, pos: Position, side: Side): Position[] {
  const results: Position[] = [];
  const forward = side === Side.Red ? -1 : 1; // 红方向上（行号减小），黑方向下（行号增大）

  // 前进一步
  const fwdR = pos.row + forward;
  if (inBounds(fwdR, pos.col)) {
    const target = board[fwdR][pos.col];
    if (!target || target.side !== side) {
      results.push({ row: fwdR, col: pos.col });
    }
  }

  // 已经过河的兵/卒可以横走（红方 row < 5 表示已过河，黑方 row > 4 表示已过河）
  const hasRivered = side === Side.Red
    ? pos.row < RIVER_RED_SIDE
    : pos.row >= RIVER_RED_SIDE;

  if (hasRivered) {
    for (const dc of [-1, 1]) {
      const nc = pos.col + dc;
      if (!inBounds(pos.row, nc)) continue;
      const target = board[pos.row][nc];
      if (!target || target.side !== side) {
        results.push({ row: pos.row, col: nc });
      }
    }
  }

  return results;
}

// ─── 公开 API ─────────────────────────────────────────────────────

/**
 * 获取指定位置的棋子的所有候选着法（不含将帅照面过滤）。
 */
function getCandidateMoves(board: Board, pos: Position, side: Side, type: PieceType): Position[] {
  switch (type) {
    case PieceType.King:     return kingMoves(board, pos, side);
    case PieceType.Advisor:  return advisorMoves(board, pos, side);
    case PieceType.Elephant: return elephantMoves(board, pos, side);
    case PieceType.Horse:    return horseMoves(board, pos, side);
    case PieceType.Rook:     return rookMoves(board, pos, side);
    case PieceType.Cannon:   return cannonMoves(board, pos, side);
    case PieceType.Pawn:     return pawnMoves(board, pos, side);
    default:                 return [];
  }
}

/**
 * 模拟走子：在副本棋盘上执行一步棋，返回新棋盘。
 */
function simulateMove(board: Board, from: Position, to: Position): Board {
  const next = cloneBoard(board);
  next[to.row][to.col] = next[from.row][from.col];
  next[from.row][from.col] = null;
  return next;
}

/**
 * 获取指定坐标棋子的所有合法落点。
 * 输入当前棋盘、指定坐标，返回所有合法目标坐标数组。
 *
 * ★ 安全模拟：走子后己方不能被将军。
 * 涵盖 将帅照面、牵制（pin）、捉双等所有违规情况。
 */
export function getLegalMoves(board: Board, row: number, col: number): Position[] {
  const piece: Piece | null = board[row]?.[col] ?? null;
  if (!piece) return [];

  const side = piece.side;
  const candidates = getCandidateMoves(board, { row, col }, side, piece.type);

  // 对每个候选落点，模拟走子后检查己方是否被将军
  return candidates.filter(target => {
    const nextBoard = simulateMove(board, { row, col }, target);
    return !isInCheck(nextBoard, side);
  });
}

/**
 * 获取某方所有棋子的所有合法走法。
 * 返回 [{ from, to }, ...]
 */
export function getAllLegalMoves(board: Board, side: Side): { from: Position; to: Position }[] {
  const results: { from: Position; to: Position }[] = [];

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const p = board[r][c];
      if (!p || p.side !== side) continue;
      const moves = getLegalMoves(board, r, c);
      for (const to of moves) {
        results.push({ from: { row: r, col: c }, to });
      }
    }
  }

  return results;
}

/**
 * 检测指定方是否被将军。
 */
export function isInCheck(board: Board, side: Side): boolean {
  // 找到己方将/帅位置
  let kingPos: Position | null = null;
  for (let r = 0; r < BOARD_ROWS && !kingPos; r++) {
    for (let c = 0; c < BOARD_COLS && !kingPos; c++) {
      const p = board[r][c];
      if (p && p.type === PieceType.King && p.side === side) {
        kingPos = { row: r, col: c };
      }
    }
  }
  if (!kingPos) return false;

  const opponent = enemy(side);

  // 检查对方所有棋子的候选着法是否能攻击到己方将/帅
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const p = board[r][c];
      if (!p || p.side !== opponent) continue;
      const candidates = getCandidateMoves(board, { row: r, col: c }, opponent, p.type);
      if (candidates.some(pos => pos.row === kingPos!.row && pos.col === kingPos!.col)) {
        return true;
      }
    }
  }

  // 另需检测 将帅照面 (飞公): 双王同列无阻挡
  if (isFlyingGeneral(board)) return true;

  return false;
}

/**
 * 检测指定方是否被将死（无合法走法）。
 */
export function isCheckmated(board: Board, side: Side): boolean {
  return getAllLegalMoves(board, side).length === 0;
}

/**
 * 终局判定。
 * @returns 'checkmate' = 绝杀 | 'stalemate' = 困毙 | false = 对局继续
 *
 * 在中国象棋中，绝杀和困毙均判负（无合法走法的一方输）。
 */
export function isGameOver(board: Board, side: Side): 'checkmate' | 'stalemate' | false {
  const hasLegalMoves = getAllLegalMoves(board, side).length > 0;
  if (hasLegalMoves) return false;

  if (isInCheck(board, side)) return 'checkmate';
  return 'stalemate';
}

/**
 * 验证一步棋对当前方是否合法。
 */
export function isValidMove(board: Board, from: Position, to: Position): boolean {
  const moves = getLegalMoves(board, from.row, from.col);
  return moves.some(m => m.row === to.row && m.col === to.col);
}
