import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { UCIEngine } from './engine';
import {
  initDatabase,
  closeDatabase,
  searchRecords,
  getRecordMoves,
  type SearchOptions,
} from './db';

const isDev = !app.isPackaged;

// 引擎实例 (单例)
let engine: UCIEngine | null = null;

/** 获取引擎可执行文件路径 (自动根据平台选择最优二进制) */
function getEnginePath(): string {
  // 皮卡鱼引擎目录 (可按需替换为其他 UCI 引擎)
  return path.join(
    app.getAppPath(),
    'engine',
    '皮卡鱼 20260131',
    'pikafish-bmi2'
  );
}

/** 启动 UCI 引擎 */
async function startEngine(): Promise<void> {
  const enginePath = getEnginePath();
  console.log(`[main] 启动引擎: ${enginePath}`);

  engine = new UCIEngine({ enginePath, multiPV: 3 });

  engine.on('close', (code) => {
    console.log(`[main] 引擎进程退出 (code=${code})`);
  });

  try {
    await engine.start();
    console.log('[main] 引擎就绪');
  } catch (err) {
    console.error('[main] 引擎启动失败:', err);
    engine = null;
  }
}

// ── 窗口创建 ───────────────────────────────────────────────────────

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'AI象棋教练',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'out', 'index.html'));
  }
}

// ── IPC 注册 ───────────────────────────────────────────────────────

function registerIPC(): void {
  /**
   * 分析局面
   * 前端调用: window.api.analyzePosition(fen)
   * 返回: AnalysisResult (top 3 候选步 + 评分)
   */
  ipcMain.handle('analyze-position', async (_event, fen: string, options?: { depth?: number; movetime?: number }) => {
    if (!engine) {
      throw new Error('引擎未就绪 — 请确认引擎文件存在于 engine/ 目录');
    }

    try {
      const result = await engine.analyze(fen, options);
      return result;
    } catch (err: any) {
      console.error('[main] 分析失败:', err.message);
      throw err;
    }
  });

  /**
   * 查询引擎状态
   * 前端调用: window.api.getEngineStatus()
   */
  ipcMain.handle('engine-status', async () => {
    return {
      ready: engine !== null,
      enginePath: getEnginePath(),
    };
  });

  /**
   * 棋谱列表分页搜索
   * 前端调用: window.api.searchRecords({ keyword, page, pageSize })
   * 返回: { data, total, page, pageSize }
   */
  ipcMain.handle('records:search', async (_event, opts: SearchOptions = {}) => {
    try {
      return searchRecords(opts ?? {});
    } catch (err: any) {
      console.error('[main] records:search 失败:', err.message);
      throw err;
    }
  });

  /**
   * 获取单局完整数据 (含 moves)
   * 前端调用: window.api.getRecordMoves(id)
   * 返回: RecordWithMoves | null
   */
  ipcMain.handle('records:get-moves', async (_event, id: number) => {
    try {
      return getRecordMoves(id);
    } catch (err: any) {
      console.error('[main] records:get-moves 失败:', err.message);
      throw err;
    }
  });

  /** 退出应用 */
  ipcMain.handle('app:quit', async () => {
    app.quit();
  });
}

// ── 生命周期 ───────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    initDatabase();
  } catch (err) {
    console.error('[main] 数据库初始化失败:', err);
    // 不阻塞引擎与 UI: 棋谱功能在前端会因 IPC 报错而提示不可用
  }

  registerIPC();
  createWindow();
  await startEngine();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 退出前强制杀死引擎子进程, 防止僵尸进程
app.on('before-quit', () => {
  if (engine) {
    engine.kill();
    engine = null;
  }
  closeDatabase();
});

app.on('will-quit', () => {
  if (engine) {
    engine.kill();
    engine = null;
  }
  closeDatabase();
});
