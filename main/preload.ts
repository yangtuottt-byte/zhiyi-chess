import { contextBridge, ipcRenderer } from 'electron';

// ---------- 与主进程 db.ts 保持一致的类型 (重复声明, 避免在 preload 里 import 主进程模块) ----------

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

interface SearchOptions {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

interface SearchResult {
  data: RecordSummary[];
  total: number;
  page: number;
  pageSize: number;
}

contextBridge.exposeInMainWorld('api', {
  /**
   * 分析 FEN 局面, 返回引擎的 Top 3 候选步与评分.
   * @param fen - 当前局面的 FEN 字符串
   * @param options - 可选 { depth, movetime } 控制引擎搜索参数
   * @returns AnalysisResult
   */
  analyzePosition: (fen: string, options?: { depth?: number; movetime?: number }) =>
    ipcRenderer.invoke('analyze-position', fen, options),

  /**
   * 查询引擎状态.
   * @returns { ready: boolean, enginePath: string }
   */
  getEngineStatus: () =>
    ipcRenderer.invoke('engine-status'),

  /**
   * 棋谱分页搜索.
   * - keyword 为空: 按 id 倒序返回最新棋谱
   * - keyword 非空: 在 red_player / black_player / event 三列模糊匹配
   * @returns Promise<SearchResult>  data 不含 moves 字段
   */
  searchRecords: (opts: SearchOptions = {}): Promise<SearchResult> =>
    ipcRenderer.invoke('records:search', opts),

  /**
   * 按 id 获取单局完整数据 (含 moves 字符串).
   * @param id 棋谱主键
   * @returns Promise<RecordWithMoves | null>
   */
  getRecordMoves: (id: number): Promise<RecordWithMoves | null> =>
    ipcRenderer.invoke('records:get-moves', id),

  /** 退出应用 */
  quitApp: () => ipcRenderer.invoke('app:quit'),
});
