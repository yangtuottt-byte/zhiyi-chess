'use client';

import { useState, useCallback } from 'react';

/** 初始 FEN — 标准中国象棋开局 */
const DEFAULT_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

export default function Home() {
  const [fen, setFen] = useState(DEFAULT_FEN);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [engineStatus, setEngineStatus] = useState<string>('未知');
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const status = await window.api.getEngineStatus();
      setEngineStatus(status.ready ? '就绪' : `未就绪 (${status.enginePath})`);
      setError(null);
    } catch (e: any) {
      setEngineStatus('检查失败: ' + e.message);
    }
  }, []);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await window.api.analyzePosition(fen);
      setResult(res);
      console.log('[AI 分析结果]', JSON.stringify(res, null, 2));
    } catch (e: any) {
      setError(e.message);
      console.error('[AI 分析失败]', e);
    } finally {
      setLoading(false);
    }
  }, [fen]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-8">
      <h1 className="text-4xl font-bold text-amber-400 drop-shadow-lg">
        欢迎来到AI象棋教练
      </h1>
      <p className="text-gray-400">练习模式 · AI教学 · 人机对战</p>

      {/* ── 引擎状态栏 ── */}
      <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
        <span className="text-sm text-gray-500">引擎状态:</span>
        <span
          className={`text-sm font-semibold ${
            engineStatus === '就绪' ? 'text-green-400' : 'text-yellow-400'
          }`}
        >
          {engineStatus}
        </span>
        <button
          onClick={checkStatus}
          className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-700"
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
          className="rounded-lg bg-amber-500 px-6 py-2 font-semibold text-gray-900 transition-all hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? '分析中...' : 'AI 分析'}
        </button>
        <button className="rounded-lg border border-amber-500/40 px-6 py-2 font-semibold text-amber-400 transition-all hover:bg-amber-500/10">
          AI教学
        </button>
        <button className="rounded-lg border border-amber-500/40 px-6 py-2 font-semibold text-amber-400 transition-all hover:bg-amber-500/10">
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
