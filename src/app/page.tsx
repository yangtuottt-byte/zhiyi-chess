'use client';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-amber-400 mb-3 drop-shadow-lg">
          欢迎来到AI象棋教练
        </h1>
        <p className="text-lg text-gray-400">
          练习模式 · AI教学 · 人机对战
        </p>
      </div>

      <div className="flex gap-4">
        <button className="rounded-lg bg-amber-500 px-8 py-3 text-lg font-semibold text-gray-900 shadow-lg transition-all hover:bg-amber-400 hover:shadow-xl active:scale-95">
          开始练习
        </button>
        <button className="rounded-lg border border-amber-500/40 px-8 py-3 text-lg font-semibold text-amber-400 shadow-lg transition-all hover:bg-amber-500/10 hover:shadow-xl active:scale-95">
          AI教学
        </button>
        <button className="rounded-lg border border-amber-500/40 px-8 py-3 text-lg font-semibold text-amber-400 shadow-lg transition-all hover:bg-amber-500/10 hover:shadow-xl active:scale-95">
          人机对战
        </button>
      </div>

      <p className="text-sm text-gray-600 mt-4">
        Electron + Next.js + Tailwind CSS 渲染成功
      </p>
    </main>
  );
}
