import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  /**
   * 分析 FEN 局面，返回引擎的 Top 3 候选步与评分。
   * @param fen - 当前局面的 FEN 字符串
   * @returns AnalysisResult { fen, sideToMove, moves: [{ multipv, depth, score, pv, ... }] }
   */
  analyzePosition: (fen: string) =>
    ipcRenderer.invoke('analyze-position', fen),

  /**
   * 查询引擎状态。
   * @returns { ready: boolean, enginePath: string }
   */
  getEngineStatus: () =>
    ipcRenderer.invoke('engine-status'),
});
