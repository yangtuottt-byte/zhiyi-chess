'use client';

import { useState } from 'react';
import type { GameMode, AIDifficulty } from '@/hooks/useChessGame';
import { DIFFICULTY_CONFIG } from '@/hooks/useChessGame';
import { Side } from '@/core/types';
import { useSound } from '@/hooks/useSound';
import { useStats } from '@/hooks/useStats';
import { useSettings } from '@/hooks/useSettings';
import { audio } from '@/lib/audio';
import StatsModal from '@/components/StatsModal';
import SettingsModal from '@/components/SettingsModal';

export interface HomeScreenProps {
  onStartGame: (mode: GameMode, difficulty: AIDifficulty, playerSide: Side) => void;
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

const DIFFICULTY_OPTIONS: Array<{
  key: AIDifficulty;
  label: string;
  desc: string;
  icon: string;
  color: string;
}> = [
  { key: 'easy', label: '简单', desc: '新手入门，快速响应', icon: '🌱', color: 'emerald' },
  { key: 'medium', label: '中等', desc: '业余水平，旗鼓相当', icon: '⚔️', color: 'amber' },
  { key: 'hard', label: '困难', desc: '深度思考，挑战极限', icon: '👑', color: 'red' },
];

export default function HomeScreen({ onStartGame }: HomeScreenProps) {
  const [selected, setSelected] = useState<GameMode>('practice');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [playerSide, setPlayerSide] = useState<Side>(Side.Red);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { isEnabled, toggle, playUI } = useSound();
  const { stats, clear, winRate } = useStats();
  const { settings, setSoundEnabled, setAnimationSpeed } = useSettings();

  const currentMode = MODES.find((m) => m.mode === selected)!;

  const handleStartClick = () => {
    playUI();
    if (currentMode.needsAI) {
      setShowSetupModal(true);
    } else {
      onStartGame(selected, 'medium', Side.Red);
    }
  };

  const handleConfirmSetup = () => {
    playUI();
    setShowSetupModal(false);
    onStartGame(selected, difficulty, playerSide);
  };

  const handleSoundToggle = (v: boolean) => {
    setSoundEnabled(v);
    if (v !== isEnabled) toggle(); // sync AudioManager
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950">
      {/* ── 顶栏按钮组 ── */}
      <div className="absolute top-5 right-5 z-50 flex items-center gap-2">
        {/* 战绩统计 */}
        <button
          onClick={() => { audio.playUI(); setShowStatsModal(true); }}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 backdrop-blur-md transition-all hover:border-slate-500/40 hover:bg-white/[0.08] hover:text-slate-200"
          title="战绩统计"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          战绩
        </button>

        {/* 设置齿轮 */}
        <button
          onClick={() => { audio.playUI(); setShowSettingsModal(true); }}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 backdrop-blur-md transition-all hover:border-slate-500/40 hover:bg-white/[0.08] hover:text-slate-200"
          title="系统设置"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

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
                onClick={() => { playUI(); setSelected(m.mode); }}
                className={`group flex items-center gap-5 rounded-2xl border px-6 py-5 text-left transition-all duration-300 ease-out ${
                  isActive
                    ? 'border-amber-500/50 bg-amber-500/10 shadow-2xl shadow-amber-500/10 -translate-y-1'
                    : 'border-white/10 bg-white/5 backdrop-blur-md hover:border-amber-500/30 hover:bg-white/[0.07] hover:-translate-y-2 hover:shadow-2xl hover:shadow-amber-500/10'
                }`}
              >
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl transition-all duration-300 ${
                    isActive
                      ? 'bg-amber-500/20 shadow-inner shadow-amber-500/20'
                      : 'bg-white/5 group-hover:bg-amber-500/10'
                  }`}
                >
                  {m.icon}
                </div>

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

        {/* ── 开始按钮 ── */}
        <button
          onClick={handleStartClick}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-14 py-4 text-lg font-bold tracking-wider text-slate-900 shadow-2xl shadow-amber-500/20 transition-all duration-300 ease-out hover:from-amber-400 hover:to-orange-500 hover:shadow-amber-500/40 active:scale-95"
        >
          <span className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative z-10">开始对局</span>
        </button>
      </div>

      {/* ══════════════ 开局设置模态框 ══════════════ */}
      {showSetupModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSetupModal(false)}
        >
          <div
            className="flex max-h-[85vh] flex-col gap-6 overflow-y-auto rounded-2xl bg-gray-900/95 px-10 py-8 shadow-2xl ring-1 ring-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-amber-400 text-center shrink-0">对局设置</h2>
            <p className="text-sm text-slate-400 text-center -mt-4">
              {selected === 'coach' ? 'AI 教学' : '人机对战'} — 配置难度与阵营
            </p>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI 难度</h3>
              <div className="grid grid-cols-3 gap-3">
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const isActive = difficulty === opt.key;
                  const config = DIFFICULTY_CONFIG[opt.key];
                  const borders: Record<string, string> = {
                    emerald: 'border-emerald-500/30 hover:border-emerald-400/60',
                    amber: 'border-amber-500/30 hover:border-amber-400/60',
                    red: 'border-red-500/30 hover:border-red-400/60',
                  };
                  const bgs: Record<string, string> = {
                    emerald: 'bg-emerald-500/10 hover:bg-emerald-500/20',
                    amber: 'bg-amber-500/10 hover:bg-amber-500/20',
                    red: 'bg-red-500/10 hover:bg-red-500/20',
                  };
                  const highlights: Record<string, string> = {
                    emerald: 'border-emerald-500/60 bg-emerald-500/20 ring-1 ring-emerald-500/30',
                    amber: 'border-amber-500/60 bg-amber-500/20 ring-1 ring-amber-500/30',
                    red: 'border-red-500/60 bg-red-500/20 ring-1 ring-red-500/30',
                  };
                  const texts: Record<string, string> = {
                    emerald: 'text-emerald-400', amber: 'text-amber-400', red: 'text-red-400',
                  };

                  return (
                    <button
                      key={opt.key}
                      onClick={() => { playUI(); setDifficulty(opt.key); }}
                      className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 transition-all duration-300 ${
                        isActive ? `${highlights[opt.color]} -translate-y-1` : `${borders[opt.color]} ${bgs[opt.color]}`
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className={`text-sm font-bold ${isActive ? texts[opt.color] : 'text-slate-400'}`}>{opt.label}</span>
                      <span className="text-[10px] text-slate-500 leading-tight text-center">{opt.desc}</span>
                      <span className="text-[10px] font-mono text-slate-600">depth={config.depth} / {config.movetime}ms</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-800" />

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">我方阵营</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => { playUI(); setPlayerSide(Side.Red); }}
                  className={`group flex flex-1 flex-col items-center gap-2 rounded-xl border px-6 py-4 transition-all duration-300 ${
                    playerSide === Side.Red
                      ? 'border-red-500/60 bg-red-500/20 ring-1 ring-red-500/30 -translate-y-1'
                      : 'border-red-500/20 bg-red-500/5 hover:border-red-500/40 hover:bg-red-500/10'
                  }`}
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold transition-all ${
                    playerSide === Side.Red ? 'bg-red-900/60 text-red-400 ring-2 ring-red-500' : 'bg-red-900/30 text-red-400/60'
                  }`}>帅</div>
                  <span className={`text-sm font-semibold ${playerSide === Side.Red ? 'text-red-300' : 'text-slate-400'}`}>我方执红</span>
                  <span className="text-[10px] text-slate-500">先手 · 标准视角</span>
                </button>

                <button
                  onClick={() => { playUI(); setPlayerSide(Side.Black); }}
                  className={`group flex flex-1 flex-col items-center gap-2 rounded-xl border px-6 py-4 transition-all duration-300 ${
                    playerSide === Side.Black
                      ? 'border-gray-500/60 bg-gray-500/20 ring-1 ring-gray-500/30 -translate-y-1'
                      : 'border-gray-500/20 bg-gray-500/5 hover:border-gray-500/40 hover:bg-gray-500/10'
                  }`}
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold transition-all ${
                    playerSide === Side.Black ? 'bg-gray-800 text-gray-300 ring-2 ring-gray-500' : 'bg-gray-800/60 text-gray-400'
                  }`}>将</div>
                  <span className={`text-sm font-semibold ${playerSide === Side.Black ? 'text-gray-300' : 'text-slate-400'}`}>我方执黑</span>
                  <span className="text-[10px] text-slate-500">后手 · 翻转视角</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowSetupModal(false)} className="rounded-lg border border-gray-600 px-5 py-2 text-sm text-slate-400 transition hover:border-gray-400 hover:text-slate-200">取消</button>
              <button onClick={handleConfirmSetup} className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-2 text-sm font-semibold text-gray-900 transition hover:from-amber-400 hover:to-orange-500 active:scale-95">开始对局</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ 战绩统计模态框 ══════════════ */}
      {showStatsModal && (
        <StatsModal
          stats={stats}
          winRate={winRate}
          onClear={clear}
          onClose={() => setShowStatsModal(false)}
        />
      )}

      {/* ══════════════ 系统设置模态框 ══════════════ */}
      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          onSoundToggle={handleSoundToggle}
          onAnimationSpeed={setAnimationSpeed}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}
