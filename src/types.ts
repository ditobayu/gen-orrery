export type Mode = 'focus' | 'short' | 'long';
export type TimerStatus = 'idle' | 'running' | 'paused';
export interface Settings { focus: number; short: number; long: number; cycles: number; sound: boolean; reducedMotion: boolean }
export interface Star { id: string; completedAt: number; durationMinutes: number; task: string; note: string }
export interface TimerState { mode: Mode; status: TimerStatus; durationMs: number; remainingMs: number; endAt: number | null; startedAt: number | null; focusCount: number }
export interface PersistedState { version: 1; settings: Settings; timer: TimerState; archive: Star[]; task: string; note: string }
export interface Machine { timer: TimerState; settings: Settings; archive: Star[]; task: string; note: string; remainingMs: number; progress: number; completion: number; storageAvailable: boolean; toggle: () => void; reset: () => void; skip: () => void; setMode: (mode: Mode) => void; updateSettings: (settings: Partial<Settings>) => void; setTask: (task: string) => void; setNote: (note: string) => void }
