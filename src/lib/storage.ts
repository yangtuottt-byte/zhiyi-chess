import type { GameMode, AIDifficulty } from '@/hooks/useChessGame';
import { Side } from '@/core/types';

const STORAGE_KEY = 'ZhiYi_Save_Slots';

export interface SaveSlot {
  id: string;
  name: string;
  timestamp: number;
  fen: string;
  fenHistory: string[];
  currentTurn: 'w' | 'b';
  gameMode: GameMode;
  playerSide: Side;
  aiDifficulty: AIDifficulty;
}

/** 从 localStorage 读取全部存档（按时间倒序） */
export function loadSlots(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr: SaveSlot[] = JSON.parse(raw);
    return arr.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

/** 写入单条存档（插入到数组最前面） */
export function saveSlot(slot: SaveSlot): void {
  const slots = loadSlots();
  slots.unshift(slot);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

/** 删除指定 ID 的存档 */
export function deleteSlot(id: string): void {
  const slots = loadSlots().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

/** 获取存档数量 */
export function slotCount(): number {
  return loadSlots().length;
}
