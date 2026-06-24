'use client';

import { useState } from 'react';
import type { AppSettings, AnimationSpeed } from '@/lib/settings';
import { audio } from '@/lib/audio';

interface SettingsModalProps {
  settings: AppSettings;
  onSoundToggle: (v: boolean) => void;
  onAnimationSpeed: (speed: AnimationSpeed) => void;
  onClose: () => void;
}

const SPEED_OPTIONS: Array<{ key: AnimationSpeed; label: string }> = [
  { key: 'slow', label: '慢' },
  { key: 'normal', label: '正常' },
  { key: 'fast', label: '快' },
];

export default function SettingsModal({
  settings,
  onSoundToggle,
  onAnimationSpeed,
  onClose,
}: SettingsModalProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-[400px] flex-col gap-5 rounded-2xl border border-white/10 bg-gray-900/95 px-8 py-7 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-amber-400 text-center">系统设置</h2>

        {/* ── 音效开关 ── */}
        <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-800/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-200">音效</p>
            <p className="text-xs text-slate-500">走子、吃子、将军、结算</p>
          </div>
          <button
            onClick={() => { audio.playUI(); onSoundToggle(!settings.soundEnabled); }}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              settings.soundEnabled ? 'bg-amber-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                settings.soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* ── 动画速度 ── */}
        <div className="rounded-xl border border-gray-800 bg-gray-800/40 px-4 py-3">
          <p className="text-sm font-medium text-slate-200 mb-2">棋子动画速度</p>
          <div className="flex rounded-lg border border-gray-700 bg-gray-800/60 p-0.5">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => { audio.playUI(); onAnimationSpeed(opt.key); }}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                  settings.animationSpeed === opt.key
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 分隔 ── */}
        <div className="border-t border-gray-800" />

        {/* ── 关于 ── */}
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-slate-300">智弈 (ZhiYi)</p>
          <p className="text-xs text-slate-500">AI 象棋教练 · v1.0.0</p>
          <p className="text-[10px] text-slate-600">Powered by Pikafish Engine</p>
        </div>

        {/* ── 关闭 ── */}
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
