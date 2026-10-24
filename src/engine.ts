import type { Mode, PersistedState, Settings, Star, TimerState } from './types';

export const STORAGE_KEY = 'orrery-one:v1';
export const MINUTE = 60_000;
export const DEFAULT_SETTINGS: Settings = {
  focus: 25,
  short: 5,
  long: 15,
  cycles: 4,
  sound: false,
  reducedMotion: false,
};

export type EngineAction =
  | { type: 'tick' | 'toggle' | 'reset' | 'skip' }
  | { type: 'mode'; mode: Mode }
  | { type: 'settings'; settings: Partial<Settings> }
  | { type: 'task' | 'note'; value: string };

export interface EngineUpdate {
  state: PersistedState;
  /** A natural phase completion, used for a single sound / visual event. */
  completed: boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isMode = (value: unknown): value is Mode =>
  value === 'focus' || value === 'short' || value === 'long';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const timestamp = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 8_640_000_000_000_000;
const textValue = (value: unknown, limit: number) => typeof value === 'string' ? value.slice(0, limit) : '';

export function clampSettings(value: unknown, previous: Settings = DEFAULT_SETTINGS): Settings {
  const input = isObject(value) ? value : {};
  const number = (key: 'focus' | 'short' | 'long' | 'cycles', max: number) =>
    isFiniteNumber(input[key]) ? clamp(Math.round(input[key]), 1, max) : previous[key];
  return {
    focus: number('focus', 120),
    short: number('short', 60),
    long: number('long', 120),
    cycles: number('cycles', 12),
    sound: typeof input.sound === 'boolean' ? input.sound : previous.sound,
    reducedMotion: typeof input.reducedMotion === 'boolean' ? input.reducedMotion : previous.reducedMotion,
  };
}

export function idleTimer(mode: Mode, settings: Settings, focusCount = 0): TimerState {
  return {
    mode,
    status: 'idle',
    durationMs: settings[mode] * MINUTE,
    remainingMs: settings[mode] * MINUTE,
    endAt: null,
    startedAt: null,
    focusCount,
  };
}

export function createDefaultState(): PersistedState {
  const settings = { ...DEFAULT_SETTINGS };
  return { version: 1, settings, timer: idleTimer('focus', settings), archive: [], task: '', note: '' };
}

/** Validate browser data field by field; malformed fields never enter the timer. */
export function normalizePersistedState(value: unknown): PersistedState {
  if (!isObject(value) || value.version !== 1) return createDefaultState();
  const settings = clampSettings(value.settings);
  const input = isObject(value.timer) ? value.timer : {};
  const mode = isMode(input.mode) ? input.mode : 'focus';
  const focusCount = isFiniteNumber(input.focusCount)
    ? clamp(Math.floor(input.focusCount), 0, Number.MAX_SAFE_INTEGER) : 0;
  const timer = idleTimer(mode, settings, focusCount);
  if (input.status === 'paused' || input.status === 'running') {
    timer.durationMs = isFiniteNumber(input.durationMs)
      ? clamp(input.durationMs, MINUTE, (mode === 'short' ? 60 : 120) * MINUTE) : timer.durationMs;
    timer.remainingMs = isFiniteNumber(input.remainingMs)
      ? clamp(input.remainingMs, 0, timer.durationMs) : timer.durationMs;
    timer.startedAt = timestamp(input.startedAt) ? input.startedAt : null;
    if (input.status === 'running' && timestamp(input.endAt)) {
      timer.status = 'running';
      timer.endAt = input.endAt;
      timer.startedAt ??= Math.max(0, input.endAt - timer.durationMs);
    } else {
      timer.status = 'paused';
    }
  }
  const ids = new Set<string>();
  const archive: Star[] = [];
  if (Array.isArray(value.archive)) {
    for (const item of value.archive) {
      if (!isObject(item) || typeof item.id !== 'string' || !item.id ||
          ids.has(item.id) || !timestamp(item.completedAt) ||
          !isFiniteNumber(item.durationMinutes) || item.durationMinutes <= 0 || item.durationMinutes > 120) continue;
      ids.add(item.id);
      archive.push({
        id: item.id,
        completedAt: item.completedAt,
        durationMinutes: item.durationMinutes,
        task: textValue(item.task, 500),
        note: textValue(item.note, 5_000),
      });
    }
  }
  timer.focusCount = Math.max(timer.focusCount, archive.length);
  return { version: 1, settings, timer, archive, task: textValue(value.task, 500), note: textValue(value.note, 5_000) };
}

export function parsePersistedState(raw: string | null): PersistedState {
  if (raw === null) return createDefaultState();
  try { return normalizePersistedState(JSON.parse(raw)); }
  catch { return createDefaultState(); }
}

/** The deadline is authoritative, even if the tab has not rendered for hours. */
export function getRemainingMs(timer: TimerState, now: number): number {
  return timer.status === 'running' && timer.endAt !== null
    ? clamp(timer.endAt - now, 0, timer.durationMs)
    : clamp(timer.remainingMs, 0, timer.durationMs);
}

export function nextMode(timer: TimerState, settings: Settings): Mode {
  if (timer.mode !== 'focus') return 'focus';
  return (timer.focusCount + 1) % settings.cycles === 0 ? 'long' : 'short';
}

/** Complete once, then park the next phase until the user starts it. */
export function settleTimer(state: PersistedState, now: number): EngineUpdate {
  const { timer } = state;
  if (timer.status !== 'running' || timer.endAt === null || now < timer.endAt) {
    return { state, completed: false };
  }
  let archive = state.archive;
  let focusCount = Math.max(timer.focusCount, archive.length);
  if (timer.mode === 'focus') {
    // Pausing can move the deadline; the original start identifies the session.
    const id = `star-${timer.startedAt}-${timer.durationMs}`;
    if (!archive.some(star => star.id === id)) {
      archive = [...archive, {
        id,
        completedAt: timer.endAt,
        durationMinutes: timer.durationMs / MINUTE,
        task: state.task,
        note: state.note,
      }];
      focusCount += 1;
    }
  }
  return {
    state: {
      ...state,
      archive,
      timer: idleTimer(timer.mode === 'focus'
        ? (focusCount % state.settings.cycles === 0 ? 'long' : 'short')
        : 'focus', state.settings, focusCount),
    },
    completed: true,
  };
}

export function transition(state: PersistedState, action: EngineAction, now: number): EngineUpdate {
  const settled = settleTimer(state, now);
  const current = settled.state;
  const { timer, settings } = current;
  // A button arriving at the deadline must not accidentally skip / start two phases.
  if (settled.completed && ['toggle', 'skip', 'reset'].includes(action.type)) return settled;
  const result = (next: PersistedState): EngineUpdate => ({ state: next, completed: settled.completed });
  switch (action.type) {
    case 'tick': return settled;
    case 'toggle': {
      if (timer.status === 'running') {
        return result({ ...current, timer: { ...timer, status: 'paused', remainingMs: getRemainingMs(timer, now), endAt: null } });
      }
      const remainingMs = timer.remainingMs > 0 ? timer.remainingMs : timer.durationMs;
      return result({ ...current, timer: {
        ...timer, status: 'running', remainingMs,
        startedAt: timer.startedAt ?? now,
        endAt: now + remainingMs,
      } });
    }
    case 'reset': return result({ ...current, timer: idleTimer(timer.mode, settings, timer.focusCount) });
    case 'skip': return result({ ...current, timer: idleTimer(nextMode(timer, settings), settings, timer.focusCount) });
    case 'mode': return result(action.mode === timer.mode ? current : {
      ...current, timer: idleTimer(action.mode, settings, timer.focusCount),
    });
    case 'settings': {
      const nextSettings = clampSettings(action.settings, settings);
      return result({ ...current, settings: nextSettings,
        timer: timer.status === 'idle' ? idleTimer(timer.mode, nextSettings, timer.focusCount) : timer });
    }
    case 'task': return result({ ...current, task: textValue(action.value, 500) });
    case 'note': return result({ ...current, note: textValue(action.value, 5_000) });
  }
}
