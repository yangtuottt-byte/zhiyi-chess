'use client';

import { useState, useRef, useEffect } from 'react';
import { audio } from '@/lib/audio';

interface SaveModalProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function defaultName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `残局_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export default function SaveModal({ onConfirm, onCancel }: SaveModalProps) {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    audio.playUI();
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-gray-900/95 px-8 py-7 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-amber-400 text-center">保存对局</h2>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">存档名称</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={40}
            className="w-72 rounded-lg border border-gray-700 bg-gray-800/80 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
            placeholder="输入存档名称..."
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-600 px-5 py-2 text-sm text-slate-400 transition hover:border-gray-400 hover:text-slate-200"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2 text-sm font-semibold text-gray-900 transition hover:from-amber-400 hover:to-orange-500 active:scale-95 disabled:opacity-40"
          >
            确认保存
          </button>
        </div>
      </div>
    </div>
  );
}
