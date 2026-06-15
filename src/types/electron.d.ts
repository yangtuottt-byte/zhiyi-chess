/** 可复用类型接口 — 全局 Window 扩展见 src/global.d.ts */

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
