'use client';

import { useState, useCallback, useEffect } from 'react';
import { useElectron } from '@/hooks/useElectron';

const DEFAULT_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

export default function Home() {
  const { mounted, isElectron, envChecked, analyzePosition, getEngineStatus } =
    useElectron();

  const [fen, setFen] = useState(DEFAULT_FEN);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [engineStatus, setEngineStatus] = useState<string>('检测中...');
  const [error, setError] = useState<string | null>(null);

  // 客户端挂载 + 环境检查完成后，尝试获取引擎状态
  useEffect(() => {
    if (!mounted || !envChecked) return;

    if (!isElectron) {
      setEngineStatus('浏览器模式 (请使用 npm run electron:dev 启动)');
      return;
    }

    getEngineStatus()
      .then((s) => setEngineStatus(s.ready ? '就绪' : `未就绪 (${s.enginePath})`))
      .catch((e) => setEngineStatus('检查失败: ' + e.message));
  }, [mounted, envChecked, isElectron, getEngineStatus]);

  const checkStatus = useCallback(async () => {
    console.log('[page] 刷新按钮被点击');
    setError(null);
    try {
      const status = await getEngineStatus();
      setEngineStatus(status.ready ? '就绪' : `未就绪 (${status.enginePath})`);
    } catch (e: any) {
      setEngineStatus('检查失败: ' + e.message);
      setError(e.message);
    }
  }, [getEngineStatus]);

  const analyze = useCallback(async () => {
    console.log('[page] AI分析按钮被点击, fen:', fen.substring(0, 30));
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await analyzePosition(fen);
      console.log('[page] AI分析结果:', res);
      setResult(res);
    } catch (e: any) {
      console.error('[page] AI分析失败:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fen, analyzePosition]);

  const handleModeClick = useCallback((mode: string) => {
    console.log(`[page] ${mode}按钮被点击 (功能开发中)`);
    setError(`${mode}功能将在后续版本中实现`);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-8">
      <h1 className="text-4xl font-bold text-amber-400 drop-shadow-lg">
        欢迎来到AI象棋教练
      </h1>
      <p className="text-gray-400">练习模式 · AI教学 · 人机对战</p>

      {/* ── 环境指示 ── */}
      <div className="rounded bg-gray-800/60 px-3 py-1 text-xs text-gray-500">
        运行环境: {!envChecked ? '检测中...' : isElectron ? 'Electron' : '浏览器'}
        {mounted ? ' (已挂载)' : ' (挂载中)'}
      </div>

      {/* ── 引擎状态栏 ── */}
      <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
        <span className="text-sm text-gray-500">引擎状态:</span>
        <span
          className={`text-sm font-semibold ${
            engineStatus.includes('就绪')
              ? 'text-green-400'
              : 'text-yellow-400'
          }`}
        >
          {engineStatus}
        </span>
        <button
          onClick={checkStatus}
          className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:bg-gray-700 hover:text-gray-200 active:scale-95"
        >
          刷新
        </button>
      </div>

      {/* ── FEN 输入区 ── */}
      <div className="w-full max-w-2xl">
        <label className="mb-1 block text-sm text-gray-500">FEN 字符串</label>
        <textarea
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm text-gray-300 focus:border-amber-500 focus:outline-none"
          rows={2}
          value={fen}
          onChange={(e) => setFen(e.target.value)}
        />
      </div>

      {/* ── 操作按钮 ── */}
      <div className="flex gap-4">
        <button
          onClick={analyze}
          disabled={loading}
          className="rounded-lg bg-amber-500 px-6 py-2 font-semibold text-gray-900 shadow-lg transition-all hover:bg-amber-400 hover:shadow-xl active:scale-95 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? '分析中...' : 'AI 分析'}
        </button>
        <button
          onClick={() => handleModeClick('AI教学')}
          className="rounded-lg border border-amber-500/40 px-6 py-2 font-semibold text-amber-400 shadow-lg transition-all hover:bg-amber-500/10 hover:shadow-xl active:scale-95"
        >
          AI教学
        </button>
        <button
          onClick={() => handleModeClick('人机对战')}
          className="rounded-lg border border-amber-500/40 px-6 py-2 font-semibold text-amber-400 shadow-lg transition-all hover:bg-amber-500/10 hover:shadow-xl active:scale-95"
        >
          人机对战
        </button>
      </div>

      {/* ── 错误提示 ── */}
      {error && (
        <div className="w-full max-w-2xl rounded-lg border border-red-500/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── 分析结果展示 ── */}
      {result && (
        <div className="w-full max-w-2xl rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <h2 className="mb-2 text-sm font-bold text-gray-300">
            分析结果 (红方视角，depth={result.moves[0]?.depth})
          </h2>
          <div className="space-y-2">
            {result.moves.map((m: any) => (
              <div
                key={m.multipv}
                className={`rounded border px-3 py-2 font-mono text-sm ${
                  m.multipv === 1
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-gray-700 bg-gray-800/30'
                }`}
              >
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="font-bold text-amber-400">#{m.multipv}</span>
                  <span>
                    分数:{' '}
                    <span
                      className={
                        m.score > 0
                          ? 'text-green-400'
                          : m.score < 0
                            ? 'text-red-400'
                            : 'text-gray-400'
                      }
                    >
                      {m.score > 0 ? '+' : ''}
                      {m.score}
                    </span>
                  </span>
                  <span>depth={m.depth}</span>
                </div>
                <div className="mt-1 text-gray-300">
                  PV: {m.pv.join(' ')}
                </div>
              </div>
            ))}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-gray-600">
              原始 JSON
            </summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-gray-950 p-2 text-xs text-gray-500">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <p className="text-xs text-gray-700 mt-4">
        Electron + Next.js + Tailwind CSS + UCI Engine
      </p>
    </main>
  );
}
