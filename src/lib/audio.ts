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
 */

type SoundName = 'move' | 'capture' | 'check' | 'gameover' | 'ui';

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
  private muted = false;

  constructor() {
    this.init('move', '/sounds/move.mp3');
    this.init('capture', '/sounds/capture.mp3');
    this.init('check', '/sounds/check.mp3', 2);
    this.init('gameover', '/sounds/gameover.mp3', 2);
    this.init('ui', '/sounds/ui.mp3', 2);
  }

  private init(name: SoundName, src: string, size?: number): void {
    try {
      this.pools[name] = new SoundPool(src, size);
    } catch {
      // 文件加载失败静默
    }
  }

  play(name: SoundName): void {
    if (this.muted) return;
    this.pools[name]?.play();
  }

  playMove(): void { this.play('move'); }
  playCapture(): void { this.play('capture'); }
  playCheck(): void { this.play('check'); }
  playGameOver(): void { this.play('gameover'); }
  playUI(): void { this.play('ui'); }

  setMuted(v: boolean): void { this.muted = v; }
  toggleMute(): boolean { this.muted = !this.muted; return this.muted; }
  isMuted(): boolean { return this.muted; }
}

/** 全局单例 */
export const audio = new AudioManager();
