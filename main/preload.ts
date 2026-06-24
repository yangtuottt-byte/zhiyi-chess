import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  /**
   * 分析 FEN 局面，返回引擎的 Top 3 候选步与评分。
   * @param fen - 当前局面的 FEN 字符串
   * @param options - 可选 { depth, movetime } 控制引擎搜索参数
   * @returns AnalysisResult
   */
  analyzePosition: (fen: string, options?: { depth?: number; movetime?: number }) =>
    ipcRenderer.invoke('analyze-position', fen, options),

  /**
   * 查询引擎状态。
   * @returns { ready: boolean, enginePath: string }
   */
  getEngineStatus: () =>
    ipcRenderer.invoke('engine-status'),
});
