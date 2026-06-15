'use client';

import { useState } from 'react';
import type { GameMode } from '@/hooks/useChessGame';

export interface HomeScreenProps {
  onStartGame: (mode: GameMode, depth: number) => void;
}

interface ModeCard {
  mode: GameMode;
  title: string;
  desc: string;
  icon: string;
  needsAI: boolean;
}

const MODES: ModeCard[] = [
  {
    mode: 'practice',
    title: '练习模式',
    desc: '自由操控红黑双方，随心打谱推演',
    icon: '♟',
    needsAI: false,
  },
  {
    mode: 'coach',
    title: 'AI 教学',
    desc: '实时分析盘面局势，Top 3 推荐走法智能指引',
    icon: '🧠',
    needsAI: true,
  },
  {
    mode: 'battle',
    title: '人机对战',
    desc: '三级难度递进挑战，与本地引擎一较高下',
    icon: '⚔',
    needsAI: true,
  },
];

const DEPTH_OPTIONS = [
  { label: '简单', value: 5 },
  { label: '中等', value: 10 },
  { label: '困难', value: 15 },
];

export default function HomeScreen({ onStartGame }: HomeScreenProps) {
  const [selected, setSelected] = useState<GameMode>('practice');
  const [depth, setDepth] = useState(10);

  const currentMode = MODES.find((m) => m.mode === selected)!;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950">
      {/* ── 径向渐变光晕 (聚光灯效果) ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(251,191,36,0.08) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute top-0 left-1/2 z-0 h-[600px] w-[800px] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(249,115,22,0.06) 0%, transparent 70%)',
        }}
      />

      {/* ── 内容层 ── */}
      <div className="relative z-10 flex flex-col items-center gap-10 px-6 py-12">
        {/* ── Hero 标题 ── */}
        <div className="text-center">
          <h1 className="text-8xl font-black leading-none tracking-wide select-none">
            <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
              智弈
            </span>
          </h1>
          <p className="mt-4 text-sm font-light tracking-widest text-slate-400">
            AI 象棋教练
          </p>
          <p className="mt-1 text-xs tracking-[0.3em] text-slate-600">
            探索棋道微光
          </p>
        </div>

        {/* ── 模式卡片 ── */}
        <div className="flex w-full max-w-3xl flex-col gap-3">
          {MODES.map((m) => {
            const isActive = selected === m.mode;
            return (
              <button
                key={m.mode}
                onClick={() => setSelected(m.mode)}
                className={`group flex items-center gap-5 rounded-2xl border px-6 py-5 text-left transition-all duration-300 ease-out ${
                  isActive
                    ? 'border-amber-500/50 bg-amber-500/10 shadow-2xl shadow-amber-500/10 -translate-y-1'
                    : 'border-white/10 bg-white/5 backdrop-blur-md hover:border-amber-500/30 hover:bg-white/[0.07] hover:-translate-y-2 hover:shadow-2xl hover:shadow-amber-500/10'
                }`}
              >
                {/* 图标 */}
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl transition-all duration-300 ${
                    isActive
                      ? 'bg-amber-500/20 shadow-inner shadow-amber-500/20'
                      : 'bg-white/5 group-hover:bg-amber-500/10'
                  }`}
                >
                  {m.icon}
                </div>

                {/* 文字 */}
                <div className="flex-1">
                  <h3
                    className={`text-xl font-bold tracking-wide transition-colors duration-300 ${
                      isActive ? 'text-amber-400' : 'text-slate-200 group-hover:text-amber-300'
                    }`}
                  >
                    {m.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 group-hover:text-slate-400 transition-colors duration-300">
                    {m.desc}
                  </p>
                </div>

                {/* 选中指示 */}
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    isActive
                      ? 'border-amber-500 bg-amber-500'
                      : 'border-slate-600 group-hover:border-slate-400'
                  }`}
                >
                  {isActive && (
                    <svg className="h-3.5 w-3.5 text-slate-950" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── 难度选择 ── */}
        {currentMode.needsAI && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium tracking-wide text-slate-500">
              AI 难度
            </span>
            <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur-md">
              {DEPTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDepth(opt.value)}
                  className={`rounded-lg px-5 py-2 text-sm font-medium transition-all duration-300 ${
                    depth === opt.value
                      ? 'bg-amber-500/20 text-amber-400 shadow-inner shadow-amber-500/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 开始按钮 ── */}
        <button
          onClick={() => onStartGame(selected, depth)}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-14 py-4 text-lg font-bold tracking-wider text-slate-900 shadow-2xl shadow-amber-500/20 transition-all duration-300 ease-out hover:from-amber-400 hover:to-orange-500 hover:shadow-amber-500/40 active:scale-95"
        >
          {/* 按钮光泽扫过动画 */}
          <span className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative z-10">开始对局</span>
        </button>
      </div>
    </div>
  );
}
