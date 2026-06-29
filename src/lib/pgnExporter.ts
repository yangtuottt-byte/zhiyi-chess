import { positionsToUci } from '@/lib/uci';
import type { MoveRecord } from '@/hooks/useChessGame';

// ─── 类型 ─────────────────────────────────────────────────────────

export interface PGNMeta {
  event?: string;
  site?: string;
  date?: string;
  red?: string;
  black?: string;
  result?: string;
}

// ─── PGN 字符串生成 ─────────────────────────────────────────────

/**
 * 将一组 MoveRecord 转换为空格分隔的 ICCS 走法串。
 * 用于从 hook 的 moveRecords 直接导出，无需额外维护 ICCS 数组。
 */
export function moveRecordsToIccs(moveRecords: (MoveRecord | null)[]): string[] {
  return moveRecords
    .filter((r): r is MoveRecord => r !== null)
    .map((r) => positionsToUci(r.from, r.to));
}

/**
 * 生成标准 PGN 文本。
 * @param moveHistory ICCS 走法字符串数组 (如 ['h2e2', 'h9g7', 'h0g2'])
 * @param meta          可选元数据 (赛果、选手、日期等)
 */
export function generatePGN(moveHistory: string[], meta?: PGNMeta): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  // ── 头部标签 ──
  const headers: string[] = [
    `[Event "${meta?.event ?? 'ZhiYi AI Match'}"]`,
    `[Site "${meta?.site ?? 'ZhiYi App'}"]`,
    `[Date "${meta?.date ?? dateStr}"]`,
    `[Red "${meta?.red ?? 'Red'}"]`,
    `[Black "${meta?.black ?? 'Black'}"]`,
    `[Result "${meta?.result ?? '*'}"]`,
    `[Format "ICCS"]`,
  ];

  // ── 走法文本 (带回合编号) ──
  const moveLines: string[] = [];
  let lineBuffer = '';

  for (let i = 0; i < moveHistory.length; i++) {
    const moveNumber = Math.floor(i / 2) + 1;
    const isRedMove = i % 2 === 0;

    if (isRedMove) {
      // 新回合开始
      if (lineBuffer.length > 0) {
        moveLines.push(lineBuffer.trimEnd());
      }
      lineBuffer = `${moveNumber}. ${moveHistory[i]} `;
    } else {
      lineBuffer += `${moveHistory[i]} `;
    }

    // 每 80 字符换行 (PGN 规范建议)
    if (lineBuffer.length > 80) {
      moveLines.push(lineBuffer.trimEnd());
      lineBuffer = '';
    }
  }

  if (lineBuffer.trim().length > 0) {
    moveLines.push(lineBuffer.trimEnd());
  }

  // 追加赛果
  const resultTag = meta?.result ?? '*';
  if (moveLines.length > 0) {
    moveLines[moveLines.length - 1] += ` ${resultTag}`;
  } else {
    moveLines.push(resultTag);
  }

  return [...headers, '', ...moveLines, ''].join('\n');
}

// ─── 浏览器下载 ─────────────────────────────────────────────────

/**
 * 触发浏览器下载 PGN 文件。
 * @param pgn      PGN 文本内容
 * @param filename 下载文件名 (不含路径)
 */
export function downloadPGN(pgn: string, filename?: string): void {
  const blob = new Blob([pgn], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `ZhiYi_Game_${Date.now()}.pgn`;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // 延迟清理 ObjectURL, 确保下载已触发
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
