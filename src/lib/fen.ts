import { Board, Piece, PieceType, Side, BOARD_ROWS, BOARD_COLS } from '@/core/types';

/** 棋子字符映射 — FEN 用字母，UI 用汉字 */
const FEN_TO_PIECE: Record<string, { type: PieceType; side: Side }> = {
  k: { type: PieceType.King, side: Side.Black },
  a: { type: PieceType.Advisor, side: Side.Black },
  b: { type: PieceType.Elephant, side: Side.Black },
  n: { type: PieceType.Horse, side: Side.Black },
  r: { type: PieceType.Rook, side: Side.Black },
  c: { type: PieceType.Cannon, side: Side.Black },
  p: { type: PieceType.Pawn, side: Side.Black },
  K: { type: PieceType.King, side: Side.Red },
  A: { type: PieceType.Advisor, side: Side.Red },
  B: { type: PieceType.Elephant, side: Side.Red },
  N: { type: PieceType.Horse, side: Side.Red },
  R: { type: PieceType.Rook, side: Side.Red },
  C: { type: PieceType.Cannon, side: Side.Red },
  P: { type: PieceType.Pawn, side: Side.Red },
};

const PIECE_TO_FEN: Record<PieceType, { r: string; b: string }> = {
  [PieceType.King]:     { r: 'K', b: 'k' },
  [PieceType.Advisor]:  { r: 'A', b: 'a' },
  [PieceType.Elephant]: { r: 'B', b: 'b' },
  [PieceType.Horse]:    { r: 'N', b: 'n' },
  [PieceType.Rook]:     { r: 'R', b: 'r' },
  [PieceType.Cannon]:   { r: 'C', b: 'c' },
  [PieceType.Pawn]:     { r: 'P', b: 'p' },
};

/** 棋子显示用汉字 */
export const PIECE_CHAR: Record<PieceType, { [Side.Red]: string; [Side.Black]: string }> = {
  [PieceType.King]:     { [Side.Red]: '帅', [Side.Black]: '将' },
  [PieceType.Advisor]:  { [Side.Red]: '仕', [Side.Black]: '士' },
  [PieceType.Elephant]: { [Side.Red]: '相', [Side.Black]: '象' },
  [PieceType.Horse]:    { [Side.Red]: '馬', [Side.Black]: '馬' },
  [PieceType.Rook]:     { [Side.Red]: '車', [Side.Black]: '車' },
  [PieceType.Cannon]:   { [Side.Red]: '炮', [Side.Black]: '炮' },
  [PieceType.Pawn]:     { [Side.Red]: '兵', [Side.Black]: '卒' },
};

/**
 * 将 FEN 字符串解析为 Board + 行棋方。
 * 标准中国象棋 FEN 格式:
 *   rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1
 */
export function fenToBoard(fen: string): { board: Board; sideToMove: Side } {
  const board: Board = Array.from({ length: BOARD_ROWS }, () =>
    Array<(Piece | null)>(BOARD_COLS).fill(null)
  );

  const parts = fen.split(' ');
  const rankStrs = parts[0].split('/');

  const idCounters = new Map<string, number>();
  const genId = (side: string, type: string): string => {
    const key = `${side}-${type}`;
    const n = (idCounters.get(key) ?? 0) + 1;
    idCounters.set(key, n);
    return `${side}-${type}-${n}`;
  };

  for (let row = 0; row < BOARD_ROWS; row++) {
    const rank = rankStrs[row];
    if (!rank) break;

    let col = 0;
    for (const ch of rank) {
      if (ch >= '1' && ch <= '9') {
        col += parseInt(ch, 10);
      } else {
        const def = FEN_TO_PIECE[ch];
        if (def && col < BOARD_COLS) {
          board[row][col] = { type: def.type, side: def.side, id: genId(def.side, def.type) };
        }
        col++;
      }
    }
  }

  const sideToMove = parts[1] === 'b' ? Side.Black : Side.Red;

  return { board, sideToMove };
}

/**
 * 将 Board + 行棋方 导出为 FEN 字符串。
 */
export function boardToFen(board: Board, sideToMove: Side): string {
  const ranks: string[] = [];

  for (let row = 0; row < BOARD_ROWS; row++) {
    let fen = '';
    let empty = 0;

    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = board[row][col];
      if (piece === null) {
        empty++;
      } else {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        const map = PIECE_TO_FEN[piece.type];
        fen += piece.side === Side.Red ? map.r : map.b;
      }
    }
    if (empty > 0) fen += empty;
    ranks.push(fen);
  }

  const sideChar = sideToMove === Side.Red ? 'w' : 'b';
  return `${ranks.join('/')} ${sideChar} - - 0 1`;
}
