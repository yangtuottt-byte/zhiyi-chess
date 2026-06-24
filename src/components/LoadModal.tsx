'use client';

import type { SaveSlot } from '@/lib/storage';
import { audio } from '@/lib/audio';

interface LoadModalProps {
  slots: SaveSlot[];
  onLoad: (slot: SaveSlot) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SIDE_LABEL: Record<string, string> = { red: '执红', black: '执黑' };
const MODE_LABEL: Record<string, string> = {
  practice: '练习模式',
  coach: 'AI 教学',
  battle: '人机对战',
};

export default function LoadModal({ slots, onLoad, onDelete, onClose }: LoadModalProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-[480px] flex-col gap-4 rounded-2xl border border-white/10 bg-gray-900/95 px-6 py-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-amber-400 text-center shrink-0">
          读取对局
        </h2>

        {slots.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <p className="text-sm text-slate-500">暂无对局存档</p>
          </div>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-800/40 px-4 py-3 transition hover:border-gray-700"
              >
                {/* 存档信息 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">
                    {slot.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {fmtTime(slot.timestamp)}
                    <span className="mx-1.5 text-slate-700">|</span>
                    {MODE_LABEL[slot.gameMode] ?? slot.gameMode}
                    <span className="mx-1.5 text-slate-700">|</span>
                    {SIDE_LABEL[slot.playerSide] ?? slot.playerSide}
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => { audio.playUI(); onLoad(slot); }}
                    className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-gray-900 transition hover:bg-amber-400 active:scale-95"
                  >
                    读取
                  </button>
                  <button
                    onClick={() => { audio.playUI(); onDelete(slot.id); }}
                    className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition hover:border-red-400/50 hover:bg-red-500/20"
                    title="删除存档"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 底部关闭 */}
        <div className="flex justify-center shrink-0">
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
