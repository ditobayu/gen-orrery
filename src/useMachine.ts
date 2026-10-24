import { useCallback, useEffect, useRef, useState } from 'react';
import type { Machine, Mode, PersistedState, Settings } from './types';
import { getRemainingMs, parsePersistedState, settleTimer, STORAGE_KEY, transition } from './engine';
import type { EngineAction } from './engine';

interface Runtime {
  state: PersistedState;
  completion: number;
  storageAvailable: boolean;
}

function bootstrap(): Runtime {
  let raw: string | null = null;
  let storageAvailable = true;
  try { raw = window.localStorage.getItem(STORAGE_KEY); }
  catch { storageAvailable = false; }
  const restored = settleTimer(parsePersistedState(raw), Date.now());
  return { state: restored.state, completion: Number(restored.completed), storageAvailable };
}

function persist(state: PersistedState): boolean {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

export function useMachine(): Machine {
  const [runtime, setRuntime] = useState<Runtime>(bootstrap);
  const stateRef = useRef(runtime.state);
  const [now, setNow] = useState(Date.now);

  const dispatch = useCallback((action: EngineAction) => {
    const clock = Date.now();
    const updated = transition(stateRef.current, action, clock);
    setNow(clock);
    if (updated.state === stateRef.current) return;
    stateRef.current = updated.state;
    const storageAvailable = persist(updated.state);
    setRuntime(previous => ({
      state: updated.state,
      completion: previous.completion + Number(updated.completed),
      storageAvailable,
    }));
  }, []);

  useEffect(() => {
    // Save recovered completions immediately so another refresh cannot earn them twice.
    const storageAvailable = persist(stateRef.current);
    setRuntime(previous => previous.storageAvailable === storageAvailable ? previous : { ...previous, storageAvailable });
    const refresh = () => dispatch({ type: 'tick' });
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      // Storage events are queued. Ignore an older write if another tab (or this
      // one) has already committed a more recent state before its event arrives.
      try {
        const storage = window.localStorage;
        if (event.storageArea && event.storageArea !== storage) return;
        if (storage.getItem(STORAGE_KEY) !== event.newValue) return;
      } catch {
        setRuntime(previous => ({ ...previous, storageAvailable: false }));
        return;
      }
      const recovered = settleTimer(parsePersistedState(event.newValue), Date.now());
      if (JSON.stringify(recovered.state) === JSON.stringify(stateRef.current)) return;
      stateRef.current = recovered.state;
      const available = recovered.completed ? persist(recovered.state) : null;
      setNow(Date.now());
      setRuntime(previous => ({
        state: recovered.state,
        completion: previous.completion + Number(recovered.completed),
        storageAvailable: available ?? previous.storageAvailable,
      }));
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [dispatch]);

  useEffect(() => {
    if (runtime.state.timer.status !== 'running') return;
    const interval = window.setInterval(() => dispatch({ type: 'tick' }), 200);
    return () => window.clearInterval(interval);
  }, [runtime.state.timer.status, dispatch]);

  const toggle = useCallback(() => dispatch({ type: 'toggle' }), [dispatch]);
  const reset = useCallback(() => dispatch({ type: 'reset' }), [dispatch]);
  const skip = useCallback(() => dispatch({ type: 'skip' }), [dispatch]);
  const setMode = useCallback((mode: Mode) => dispatch({ type: 'mode', mode }), [dispatch]);
  const updateSettings = useCallback((settings: Partial<Settings>) => dispatch({ type: 'settings', settings }), [dispatch]);
  const setTask = useCallback((value: string) => dispatch({ type: 'task', value }), [dispatch]);
  const setNote = useCallback((value: string) => dispatch({ type: 'note', value }), [dispatch]);

  const { state, completion, storageAvailable } = runtime;
  const remainingMs = getRemainingMs(state.timer, now);
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / state.timer.durationMs));
  return { ...state, remainingMs, progress, completion, storageAvailable,
    toggle, reset, skip, setMode, updateSettings, setTask, setNote };
}
