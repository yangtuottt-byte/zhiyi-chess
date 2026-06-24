/** 棋子类型 */
export enum PieceType {
  King = 'king',       // 将/帅
  Advisor = 'advisor', // 士/仕
  Elephant = 'elephant', // 象/相
  Horse = 'horse',     // 马
  Rook = 'rook',       // 车
  Cannon = 'cannon',   // 炮
  Pawn = 'pawn',       // 兵/卒
}

/** 阵营 */
export enum Side {
  Red = 'red',
  Black = 'black',
}

/** 棋子 */
export interface Piece {
  type: PieceType;
  side: Side;
  id?: string; // 稳定 ID 用于 React 动画 key
}

/** 棋盘坐标 */
export interface Position {
  row: number;
  col: number;
}

/** 棋盘状态 — 10 行 × 9 列，null 表示空位 */
export type Board = (Piece | null)[][];

/** 棋盘常量 */
export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;
export const RIVER_RED_SIDE = 5; // 红方半场起始行（0-4 为黑方半场）

/** 九宫格范围 */
export const PALACE: Record<Side, { rowMin: number; rowMax: number; colMin: number; colMax: number }> = {
  [Side.Black]: { rowMin: 0, rowMax: 2, colMin: 3, colMax: 5 },
  [Side.Red]:   { rowMin: 7, rowMax: 9, colMin: 3, colMax: 5 },
};

/** 获取初始棋盘布局 */
export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_ROWS }, () =>
    Array(BOARD_COLS).fill(null)
  );

  const counters = new Map<string, number>();
  const pid = (type: PieceType, side: Side): string => {
    const key = `${side}-${type}`;
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    return `${side}-${type}-${n}`;
  };

  const p = (type: PieceType, side: Side): Piece => ({ type, side, id: pid(type, side) });

  // 黑方底线 (row 0)
  board[0][0] = p(PieceType.Rook, Side.Black);
  board[0][1] = p(PieceType.Horse, Side.Black);
  board[0][2] = p(PieceType.Elephant, Side.Black);
  board[0][3] = p(PieceType.Advisor, Side.Black);
  board[0][4] = p(PieceType.King, Side.Black);
  board[0][5] = p(PieceType.Advisor, Side.Black);
  board[0][6] = p(PieceType.Elephant, Side.Black);
  board[0][7] = p(PieceType.Horse, Side.Black);
  board[0][8] = p(PieceType.Rook, Side.Black);

  // 黑炮 (row 2)
  board[2][1] = p(PieceType.Cannon, Side.Black);
  board[2][7] = p(PieceType.Cannon, Side.Black);

  // 黑卒 (row 3)
  board[3][0] = p(PieceType.Pawn, Side.Black);
  board[3][2] = p(PieceType.Pawn, Side.Black);
  board[3][4] = p(PieceType.Pawn, Side.Black);
  board[3][6] = p(PieceType.Pawn, Side.Black);
  board[3][8] = p(PieceType.Pawn, Side.Black);

  // 红兵 (row 6)
  board[6][0] = p(PieceType.Pawn, Side.Red);
  board[6][2] = p(PieceType.Pawn, Side.Red);
  board[6][4] = p(PieceType.Pawn, Side.Red);
  board[6][6] = p(PieceType.Pawn, Side.Red);
  board[6][8] = p(PieceType.Pawn, Side.Red);

  // 红炮 (row 7)
  board[7][1] = p(PieceType.Cannon, Side.Red);
  board[7][7] = p(PieceType.Cannon, Side.Red);

  // 红方底线 (row 9)
  board[9][0] = p(PieceType.Rook, Side.Red);
  board[9][1] = p(PieceType.Horse, Side.Red);
  board[9][2] = p(PieceType.Elephant, Side.Red);
  board[9][3] = p(PieceType.Advisor, Side.Red);
  board[9][4] = p(PieceType.King, Side.Red);
  board[9][5] = p(PieceType.Advisor, Side.Red);
  board[9][6] = p(PieceType.Elephant, Side.Red);
  board[9][7] = p(PieceType.Horse, Side.Red);
  board[9][8] = p(PieceType.Rook, Side.Red);

  return board;
}
