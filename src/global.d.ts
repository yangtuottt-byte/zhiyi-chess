/**
 * 全局 Window 接口扩展 — 与 main/preload.ts 暴露的 API 保持一致。
 * 此文件不含 import/export，属于 Ambient Declaration，
 * 确保 Next.js 和 TypeScript 在整个项目中都能识别 window.api。
 */

interface Window {
  api: {
    analyzePosition(fen: string): Promise<{
      fen: string;
      sideToMove: 'w' | 'b';
      moves: Array<{
        multipv: number;
        depth: number;
        score: number;
        scoreType: 'cp' | 'mate';
        mateIn?: number;
        pv: string[];
        pvChinese: string;
      }>;
    }>;
    getEngineStatus(): Promise<{
      ready: boolean;
      enginePath: string;
    }>;
  };
}
