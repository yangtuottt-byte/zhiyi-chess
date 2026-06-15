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
    desc: '自由操控红黑双方\n自我对弈，任意打谱',
    icon: '♟',
    needsAI: false,
  },
  {
    mode: 'coach',
    title: 'AI 教学',
    desc: 'AI 实时分析局势\nTop 3 推荐走法指引',
    icon: '🧠',
    needsAI: true,
  },
  {
    mode: 'battle',
    title: '人机对战',
    desc: '与电脑一较高下\n三级难度任你挑战',
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10">
      {/* ── 标题区 ── */}
      <div className="text-center">
        <h1 className="text-7xl font-bold tracking-widest text-amber-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.3)]">
          智弈
        </h1>
        <p className="mt-3 text-base text-gray-400 tracking-wide">
          AI 象棋教练
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Electron + Next.js · 本地引擎驱动
        </p>
      </div>

      {/* ── 模式卡片 ── */}
      <div className="flex gap-4 max-w-2xl w-full">
        {MODES.map((m) => {
          const isActive = selected === m.mode;
          return (
            <button
              key={m.mode}
              onClick={() => setSelected(m.mode)}
              className={`flex-1 rounded-xl border-2 p-6 text-center transition-all duration-200 ${
                isActive
                  ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10 scale-[1.03]'
                  : 'border-gray-700 bg-gray-800/40 hover:border-gray-500 hover:bg-gray-800/60'
              }`}
            >
              <div className="text-4xl mb-3">{m.icon}</div>
              <h3
                className={`text-lg font-bold mb-1.5 ${
                  isActive ? 'text-amber-400' : 'text-gray-300'
                }`}
              >
                {m.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">
                {m.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── 难度选择 (仅 AI 模式) ── */}
      {currentMode.needsAI && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">AI 难度</span>
          <div className="flex rounded-lg border border-gray-700 bg-gray-800/50 p-0.5">
            {DEPTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDepth(opt.value)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                  depth === opt.value
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                    : 'text-gray-400 hover:text-gray-200'
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
        className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-12 py-3.5 text-lg font-bold text-gray-900 shadow-xl shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-2xl hover:shadow-amber-500/30 active:scale-95"
      >
        开始对局
      </button>
    </div>
  );
}
