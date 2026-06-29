/**
 * 全局 Window 接口扩展 — 与 main/preload.ts 暴露的 API 保持一致。
 * 此文件不含 import/export，属于 Ambient Declaration，
 * 确保 Next.js 和 TypeScript 在整个项目中都能识别 window.api。
 */

interface RecordSummary {
  id: number;
  event: string | null;
  red_team: string | null;
  red_player: string | null;
  black_team: string | null;
  black_player: string | null;
  result: string | null;
  opening: string | null;
}

interface RecordWithMoves extends RecordSummary {
  moves: string;
}

interface SearchRecordsOptions {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

interface SearchRecordsResult {
  data: RecordSummary[];
  total: number;
  page: number;
  pageSize: number;
}

interface Window {
  api: {
    analyzePosition(fen: string, options?: { depth?: number; movetime?: number }): Promise<{
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
    searchRecords(opts?: SearchRecordsOptions): Promise<SearchRecordsResult>;
    getRecordMoves(id: number): Promise<RecordWithMoves | null>;
    quitApp(): Promise<void>;
  };
}
