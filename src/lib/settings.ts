const SETTINGS_KEY = 'ZhiYi_Settings';

export type AnimationSpeed = 'slow' | 'normal' | 'fast';

export const ANIMATION_DURATION: Record<AnimationSpeed, string> = {
  slow: '0.5s',
  normal: '0.3s',
  fast: '0.15s',
};

export interface AppSettings {
  soundEnabled: boolean;
  animationSpeed: AnimationSpeed;
}

const DEFAULTS: AppSettings = {
  soundEnabled: true,
  animationSpeed: 'normal',
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* 静默 */ }
}

export function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): AppSettings {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
  return settings;
}
