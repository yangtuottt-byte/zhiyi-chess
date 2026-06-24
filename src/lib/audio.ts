/**
 * 音效管理器 — 基于 HTML5 Audio 池，支持多音效同时播放。
 *
 * 音频文件请放置在 public/sounds/ 目录下：
 *   move.mp3     — 普通走子
 *   capture.mp3  — 吃子
 *   check.mp3    — 将军
 *   gameover.mp3 — 终局
 *   ui.mp3       — UI 交互
 *
 * 文件缺失时静默降级，不会报错。
 *
 * 设置持久化到 localStorage → ZhiYi_Settings.soundEnabled
 */

type SoundName = 'move' | 'capture' | 'check' | 'gameover' | 'ui';
type ChangeListener = (enabled: boolean) => void;

const SETTINGS_KEY = 'ZhiYi_Settings';

function loadSoundSetting(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return true;
    const data = JSON.parse(raw);
    return data.soundEnabled !== false;
  } catch {
    return true;
  }
}

function saveSoundSetting(enabled: boolean): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data.soundEnabled = enabled;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch { /* 静默失败 */ }
}

class SoundPool {
  private pool: HTMLAudioElement[] = [];
  private cursor = 0;

  constructor(src: string, size = 4) {
    for (let i = 0; i < size; i++) {
      const a = new Audio(src);
      a.preload = 'auto';
      a.volume = 0.6;
      this.pool.push(a);
    }
  }

  play(): void {
    const a = this.pool[this.cursor];
    a.currentTime = 0;
    a.play().catch(() => {});
    this.cursor = (this.cursor + 1) % this.pool.length;
  }
}

class AudioManager {
  private pools: Partial<Record<SoundName, SoundPool>> = {};
  private enabled: boolean;
  private listeners: Set<ChangeListener> = new Set();

  constructor() {
    this.enabled = loadSoundSetting();

    this.init('move', '/sounds/move.mp3');
    this.init('capture', '/sounds/capture.mp3');
    this.init('check', '/sounds/check.mp3', 2);
    this.init('gameover', '/sounds/gameover.mp3', 2);
    this.init('ui', '/sounds/ui.mp3', 2);
  }

  // ── 池初始化 ────────────────────────────────────────────────

  private init(name: SoundName, src: string, size?: number): void {
    try {
      this.pools[name] = new SoundPool(src, size);
    } catch {
      // 文件加载失败静默
    }
  }

  // ── 播放 ────────────────────────────────────────────────────

  private play(name: SoundName): void {
    if (!this.enabled) return;
    this.pools[name]?.play();
  }

  playMove(): void     { this.play('move'); }
  playCapture(): void  { this.play('capture'); }
  playCheck(): void    { this.play('check'); }
  playGameOver(): void { this.play('gameover'); }
  playUI(): void       { this.play('ui'); }

  // ── 开关 ────────────────────────────────────────────────────

  setEnabled(v: boolean): void {
    if (this.enabled === v) return;
    this.enabled = v;
    saveSoundSetting(v);
    this.listeners.forEach((fn) => fn(v));
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ── 订阅 (React Hook 用) ────────────────────────────────────

  onChange(fn: ChangeListener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  // ── 兼容旧 API ──────────────────────────────────────────────

  setMuted(v: boolean): void { this.setEnabled(!v); }
  toggleMute(): boolean      { this.toggle(); return !this.enabled; }
  isMuted(): boolean         { return !this.enabled; }
}

/** 全局单例 */
export const audio = new AudioManager();
