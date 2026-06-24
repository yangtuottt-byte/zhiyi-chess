import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import os from 'os';

// ─── types ─────────────────────────────────────────────────────────

export interface AnalyzedMove {
  multipv: number;      // 1 = 最佳, 2 = 次选, 3 = 第三选择
  depth: number;        // 搜索深度
  score: number;        // 红方视角分数 (centipawns)
  scoreType: 'cp' | 'mate';
  mateIn?: number;      // 原始 mate-in 值 (正=引擎方将杀对方)
  pv: string[];         // UCI 走法序列 ["h2e2", "h9g7", ...]
  pvChinese: string;    // 仅供展示 (如需要)
}

export interface AnalysisResult {
  fen: string;
  sideToMove: 'w' | 'b';
  moves: AnalyzedMove[];
}

export interface EngineConfig {
  enginePath: string;   // 引擎可执行文件完整路径 (不包含扩展名)
  multiPV?: number;     // 返回前 N 个最佳候选步，默认 3
}

// ─── helpers ───────────────────────────────────────────────────────

/**
 * 从 FEN 字符串中提取行棋方。
 * FEN 第 2 段: 'w' = 红方行棋, 'b' = 黑方行棋
 */
function getSideToMove(fen: string): 'w' | 'b' {
  const parts = fen.split(' ');
  return (parts[1] === 'b' ? 'b' : 'w');
}

/**
 * 将 UCI 引擎输出的分数转换为红方视角。
 * UCI 分数基于当前行棋方：正 = 行棋方优势。
 * 转换后：正 = 红方优势。
 */
function toRedPerspective(rawScore: number, sideToMove: 'w' | 'b'): number {
  return sideToMove === 'w' ? rawScore : -rawScore;
}

// ─── UCI Engine ────────────────────────────────────────────────────

export class UCIEngine extends EventEmitter {
  private process: ChildProcess | null = null;
  private enginePath: string;
  private multiPV: number;
  private isReady = false;

  // 单次分析的状态
  private pendingResolve: ((result: AnalysisResult) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private currentFEN = '';
  /** 用 Map 收集 multipv 条目，同编号的后面覆盖前面（迭代加深时取更深层） */
  private infoMap: Map<number, AnalyzedMove> = new Map();

  // 文本缓冲区 — 处理引擎输出的分片到达
  private buffer = '';

  constructor(config: EngineConfig) {
    super();
    // 根据平台自动补扩展名
    const ext = os.platform() === 'win32' ? '.exe' : '';
    this.enginePath = config.enginePath + ext;
    this.multiPV = config.multiPV ?? 3;
  }

  // ── 生命周期 ─────────────────────────────────────────────────

  /** 启动引擎并完成 UCI 握手 */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.enginePath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.on('error', (err) => {
        reject(new Error(`无法启动引擎 (${this.enginePath}): ${err.message}`));
      });

      this.process.on('close', (code) => {
        this.isReady = false;
        this.emit('close', code);
      });

      if (!this.process.stdout || !this.process.stderr) {
        reject(new Error('引擎进程缺少 stdio 流'));
        return;
      }

      this.process.stdout.on('data', (data: Buffer) => {
        this.onData(data.toString());
      });

      this.process.stderr.on('data', (data: Buffer) => {
        console.error('[engine stderr]', data.toString().trim());
      });

      // UCI 握手序列: uci → (等 uciok) → setoption → isready → (等 readyok)
      this.send('uci');

      const onUciOk = () => {
        this.send(`setoption name MultiPV value ${this.multiPV}`);
        this.send('isready');
      };

      this.once('uciok', onUciOk);

      const onReady = () => {
        this.isReady = true;
        this.removeListener('ready', onReady);
        resolve();
      };

      this.on('ready', onReady);

      // 超时保护 (10 秒)
      setTimeout(() => {
        if (!this.isReady) {
          reject(new Error('引擎启动超时 — 请确认引擎文件路径正确且可执行'));
        }
      }, 10_000);
    });
  }

  /** 分析指定 FEN 局面，返回前 N 个候选走法 */
  async analyze(
    fen: string,
    options?: { depth?: number; movetime?: number }
  ): Promise<AnalysisResult> {
    if (!this.isReady || !this.process) {
      throw new Error('引擎尚未就绪');
    }

    if (this.pendingResolve) {
      throw new Error('引擎正在分析中，请等待当前分析完成');
    }

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.currentFEN = fen;
      this.infoMap.clear();

      this.send(`position fen ${fen}`);

      // 动态构建 go 指令
      const depth = options?.depth ?? 10;
      let goCmd = `go depth ${depth}`;
      if (options?.movetime && options.movetime > 0) {
        goCmd += ` movetime ${options.movetime}`;
      }
      console.log(`[engine] UCI 指令: ${goCmd}`);
      this.send(goCmd);
    });
  }

  /** 优雅退出 */
  quit(): void {
    if (this.process) {
      this.send('quit');
      setTimeout(() => this.kill(), 2000);
    }
  }

  /** 强制杀死进程 */
  kill(): void {
    if (this.process) {
      this.process.kill('SIGKILL');
      this.process = null;
      this.isReady = false;
    }
  }

  // ── 内部方法 ─────────────────────────────────────────────────

  private send(cmd: string): void {
    if (this.process?.stdin && !this.process.stdin.destroyed) {
      this.process.stdin.write(cmd + '\n');
    }
  }

  /** 处理引擎的 stdout 数据 */
  private onData(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    // 最后一段可能不完整，保留在缓冲区
    this.buffer = lines.pop() || '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (line === 'uciok') {
        this.emit('uciok');
        continue;
      }

      if (line === 'readyok') {
        this.isReady = true;
        this.emit('ready');
        continue;
      }

      // 核心：解析带 multipv 的 info 行
      if (line.startsWith('info ') && line.includes(' multipv ')) {
        const move = this.parseInfoLine(line);
        if (move) {
          // 同编号覆盖（迭代加深取更深层结果）
          this.infoMap.set(move.multipv, move);
        }
        continue;
      }

      // bestmove 标志本次分析结束
      if (line.startsWith('bestmove')) {
        this.finishAnalysis();
        continue;
      }
    }
  }

  /**
   * 解析单行 info 输出，例如:
   *   info depth 15 seldepth 22 multipv 1 score cp 35 nodes 12345 time 123 pv h2e2 h9g7
   *   info depth 12 multipv 2 score mate 5 pv b0c2 b7e7
   */
  private parseInfoLine(line: string): AnalyzedMove | null {
    // 使用正则按位置提取，避免字段顺序不同的坑
    const depth = parseInt(/depth (\d+)/.exec(line)?.[1] ?? '0', 10);
    const multipv = parseInt(/multipv (\d+)/.exec(line)?.[1] ?? '0', 10);
    if (multipv === 0) return null;

    const pvStart = line.indexOf(' pv ');
    if (pvStart === -1) return null;
    const pv = line.slice(pvStart + 4).trim().split(/\s+/);

    const scoreMatch = /score (cp|mate) (-?\d+)/.exec(line);
    let scoreType: 'cp' | 'mate' = 'cp';
    let rawScore = 0;
    let mateIn: number | undefined;

    if (scoreMatch) {
      scoreType = scoreMatch[1] as 'cp' | 'mate';
      rawScore = parseInt(scoreMatch[2], 10);
      if (scoreType === 'mate') {
        mateIn = rawScore;
      }
    }

    const sideToMove = getSideToMove(this.currentFEN);

    return {
      multipv,
      depth,
      score: toRedPerspective(
        scoreType === 'mate'
          ? (rawScore > 0 ? 10000 - rawScore : -10000 - rawScore)
          : rawScore,
        sideToMove
      ),
      scoreType,
      mateIn,
      pv,
      pvChinese: '', // 留空，后续 Phase 可扩展 UCI→中文转换
    };
  }

  /** 收集完毕，resolve Promise */
  private finishAnalysis(): void {
    if (!this.pendingResolve) return;

    const sideToMove = getSideToMove(this.currentFEN);

    // 按 multipv 排序，取前 multiPV 个
    const moves = Array.from(this.infoMap.values())
      .sort((a, b) => a.multipv - b.multipv)
      .slice(0, this.multiPV);

    this.pendingResolve({
      fen: this.currentFEN,
      sideToMove,
      moves,
    });

    this.pendingResolve = null;
    this.pendingReject = null;
  }
}
