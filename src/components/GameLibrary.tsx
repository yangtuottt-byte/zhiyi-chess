'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '@/lib/audio';

// ──────────────────────────────────────────────────────────────────────
//  类型 (与 main/db.ts 输出契合, 不引入主进程 import)
// ──────────────────────────────────────────────────────────────────────

interface GameLibraryProps {
  onBack: () => void;
}

const PAGE_SIZE = 15;
const DEBOUNCE_MS = 300;

// ──────────────────────────────────────────────────────────────────────
//  结果着色: 1-0 红胜, 0-1 黑胜, 1/2-1/2 和棋, 其他未知
// ──────────────────────────────────────────────────────────────────────

function ResultPill({ result }: { result: string | null }) {
  const r = (result ?? '').trim();
  let label = r || '?';
  let cls = 'border-slate-600/40 bg-slate-500/10 text-slate-400';

  if (r === '1-0') {
    label = '红胜';
    cls = 'border-red-500/40 bg-red-500/10 text-red-300';
  } else if (r === '0-1') {
    label = '黑胜';
    cls = 'border-slate-400/40 bg-slate-400/10 text-slate-200';
  } else if (r === '1/2-1/2') {
    label = '和棋';
    cls = 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  组件主体
// ──────────────────────────────────────────────────────────────────────

export default function GameLibrary({ onBack }: GameLibraryProps) {
  const [keywordInput, setKeywordInput] = useState('');          // 输入框即时值
  const [keyword, setKeyword] = useState('');                    // 防抖后用于查询
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowLoadingId, setRowLoadingId] = useState<number | null>(null);

  // ── 防抖: 输入停 300ms 后才更新 keyword + 重置页码 ──
  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(keywordInput.trim());
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [keywordInput]);

  // ── 防止过期响应覆盖最新结果 (race) ──
  const requestSeqRef = useRef(0);

  // ── 数据拉取 ──
  useEffect(() => {
    if (typeof window === 'undefined' || !window.api?.searchRecords) {
      setError('当前环境不可用 (请通过 electron:dev 启动)');
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);

    window.api
      .searchRecords({ keyword, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (seq !== requestSeqRef.current) return; // 过期响应
        setRecords(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .catch((e: any) => {
        if (seq !== requestSeqRef.current) return;
        console.error('[GameLibrary] searchRecords 失败:', e);
        setError(e?.message || '查询失败');
        setRecords([]);
        setTotal(0);
      })
      .finally(() => {
        if (seq === requestSeqRef.current) setLoading(false);
      });
  }, [keyword, page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );
  const safePage = Math.min(page, totalPages);
  const isFirstPage = safePage <= 1;
  const isLastPage = safePage >= totalPages;

  // ── 行点击: 取 moves 字符串 ──
  const handleRowClick = useCallback(async (rec: RecordSummary) => {
    if (typeof window === 'undefined' || !window.api?.getRecordMoves) return;
    audio.playUI();
    setRowLoadingId(rec.id);
    try {
      const data = await window.api.getRecordMoves(rec.id);
      if (!data) {
        alert(`未找到 id=${rec.id} 的棋谱`);
        return;
      }
      console.log('[GameLibrary] 棋谱加载完成', {
        id: data.id,
        event: data.event,
        red: data.red_player,
        black: data.black_player,
        result: data.result,
        moves: data.moves,
      });
      console.log('[GameLibrary] ICCS 走法:\n' + data.moves);
      alert(
        `正在为您加载这盘棋谱...\n\n` +
        `赛事: ${data.event ?? '—'}\n` +
        `红方: ${data.red_player ?? '—'}\n` +
        `黑方: ${data.black_player ?? '—'}\n` +
        `结果: ${data.result ?? '—'}\n` +
        `走法步数: ${data.moves.split(/\s+/).filter(Boolean).length}`
      );
    } catch (e: any) {
      console.error('[GameLibrary] getRecordMoves 失败:', e);
      alert('加载失败: ' + (e?.message ?? e));
    } finally {
      setRowLoadingId(null);
    }
  }, []);

  // ── 分页 ──
  const goPrev = () => { if (!isFirstPage) { audio.playUI(); setPage((p) => p - 1); } };
  const goNext = () => { if (!isLastPage)  { audio.playUI(); setPage((p) => p + 1); } };
  const goFirst = () => { if (!isFirstPage) { audio.playUI(); setPage(1); } };
  const goLast = () => { if (!isLastPage)  { audio.playUI(); setPage(totalPages); } };

  // ── 渲染 ──
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950">
      {/* ── 背景光晕 ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(34,211,238,0.07) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[400px] w-[800px] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(99,102,241,0.05) 0%, transparent 70%)',
        }}
      />

      {/* ── 顶部栏 ── */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-8 pb-4">
        <button
          onClick={() => { audio.playUI(); onBack(); }}
          className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 backdrop-blur-md transition-all hover:border-cyan-400/40 hover:bg-white/[0.08] hover:text-cyan-200"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回主菜单
        </button>

        <div className="text-right">
          <h1 className="text-3xl font-black tracking-wide">
            <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
              棋谱大厅
            </span>
          </h1>
          <p className="mt-0.5 text-xs tracking-widest text-slate-500">
            GAME LIBRARY · {total.toLocaleString()} 局可检索
          </p>
        </div>
      </header>

      {/* ── 搜索区 ── */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-4 pb-6">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </div>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="输入赛事或选手拼音搜索 (如 XU Jian 或 Championship)..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-4 pl-12 pr-12 text-base text-slate-200 placeholder-slate-600 backdrop-blur-md outline-none transition-all focus:border-cyan-400/60 focus:bg-white/[0.06] focus:shadow-lg focus:shadow-cyan-500/10"
          />
          {keywordInput && (
            <button
              onClick={() => { audio.playUI(); setKeywordInput(''); }}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-500 transition hover:text-slate-300"
              title="清空"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>
            {loading
              ? '查询中...'
              : keyword
                ? <>命中 <span className="font-mono text-cyan-300">{total.toLocaleString()}</span> 局 · 关键词 <span className="font-mono text-slate-300">"{keyword}"</span></>
                : <>共 <span className="font-mono text-slate-300">{total.toLocaleString()}</span> 局</>
            }
          </span>
          {error && <span className="text-red-400">{error}</span>}
        </div>
      </section>

      {/* ── 表格区 ── */}
      <section className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-6 pb-4">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-2xl shadow-slate-950/40">
          {/* 表头 */}
          <div className="grid grid-cols-[3fr_2fr_2fr_1fr_0.6fr] gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            <span>赛事 · Event</span>
            <span>红方 · Red</span>
            <span>黑方 · Black</span>
            <span>结果 · Result</span>
            <span className="text-right">#</span>
          </div>

          {/* 行 */}
          <div className="divide-y divide-white/[0.04]">
            {loading && records.length === 0 && (
              <div className="flex items-center justify-center py-20 text-slate-500">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-400 mr-2" />
                正在加载棋谱...
              </div>
            )}

            {!loading && records.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-500">
                <span className="text-4xl opacity-40">🗂️</span>
                <p className="text-sm">无匹配棋谱</p>
                <p className="text-xs text-slate-600">试试 Championship / XU Jian / Final 等关键词</p>
              </div>
            )}

            {records.map((rec) => {
              const isRowLoading = rowLoadingId === rec.id;
              return (
                <div
                  key={rec.id}
                  onClick={() => !isRowLoading && handleRowClick(rec)}
                  className={`group grid grid-cols-[3fr_2fr_2fr_1fr_0.6fr] items-center gap-4 px-5 py-3 transition-all cursor-pointer ${
                    isRowLoading
                      ? 'bg-cyan-500/5'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-200 group-hover:text-cyan-200 transition-colors">
                      {rec.event ?? <span className="text-slate-600 italic">未署赛事</span>}
                    </p>
                    {rec.opening && (
                      <p className="truncate text-[11px] text-slate-600 mt-0.5">
                        开局 · {rec.opening}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-red-300/90">
                      {rec.red_player ?? <span className="text-slate-600 italic">—</span>}
                    </p>
                    {rec.red_team && (
                      <p className="truncate text-[11px] text-slate-600">{rec.red_team}</p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-300">
                      {rec.black_player ?? <span className="text-slate-600 italic">—</span>}
                    </p>
                    {rec.black_team && (
                      <p className="truncate text-[11px] text-slate-600">{rec.black_team}</p>
                    )}
                  </div>
                  <div>
                    <ResultPill result={rec.result} />
                  </div>
                  <div className="text-right">
                    {isRowLoading ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                    ) : (
                      <span className="font-mono text-[11px] text-slate-600 group-hover:text-cyan-400/60 transition-colors">
                        #{rec.id}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 分页 ── */}
      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-8">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 backdrop-blur-md">
          <div className="text-xs text-slate-500">
            每页 <span className="font-mono text-slate-300">{PAGE_SIZE}</span> 条 ·
            当前第 <span className="font-mono text-cyan-300">{safePage}</span> /
            <span className="font-mono text-slate-300"> {totalPages.toLocaleString()}</span> 页
          </div>

          <div className="flex items-center gap-1.5">
            <PageBtn onClick={goFirst} disabled={isFirstPage} label="首页">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M21 19l-7-7 7-7" />
              </svg>
            </PageBtn>
            <PageBtn onClick={goPrev} disabled={isFirstPage} label="上一页" wide>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              上一页
            </PageBtn>

            <div className="mx-2 flex items-center gap-1 font-mono text-sm">
              <span className="text-cyan-300">{safePage}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">{totalPages.toLocaleString()}</span>
            </div>

            <PageBtn onClick={goNext} disabled={isLastPage} label="下一页" wide>
              下一页
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </PageBtn>
            <PageBtn onClick={goLast} disabled={isLastPage} label="末页">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M3 5l7 7-7 7" />
              </svg>
            </PageBtn>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  小组件: 分页按钮
// ──────────────────────────────────────────────────────────────────────

function PageBtn({
  onClick,
  disabled,
  label,
  wide,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-lg border ${wide ? 'px-3' : 'px-2'} py-1.5 text-xs transition-all ${
        disabled
          ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-700'
          : 'border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200 active:scale-95'
      }`}
    >
      {children}
    </button>
  );
}
