/** 前端 TypeScript 类型声明 — 与 main/preload.ts 暴露的 API 保持一致 */

export interface AnalyzedMove {
  multipv: number;
  depth: number;
  score: number;
  scoreType: 'cp' | 'mate';
  mateIn?: number;
  pv: string[];
  pvChinese: string;
}

export interface AnalysisResult {
  fen: string;
  sideToMove: 'w' | 'b';
  moves: AnalyzedMove[];
}

export interface EngineStatus {
  ready: boolean;
  enginePath: string;
}

export interface ElectronAPI {
  analyzePosition: (fen: string) => Promise<AnalysisResult>;
  getEngineStatus: () => Promise<EngineStatus>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
