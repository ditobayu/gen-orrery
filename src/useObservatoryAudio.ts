import { useCallback, useEffect, useRef } from 'react';
import type { Mode } from './types';

interface AudioOptions {
  enabled: boolean;
  running: boolean;
  mode: Mode;
  completion: number;
}

interface ObservatoryAudio {
  context: AudioContext;
  master: GainNode;
  voices: OscillatorNode[];
  filter: BiquadFilterNode;
  noiseGain: GainNode;
  suspendTimer?: number;
}

const pitches: Record<Mode, number> = { focus: 55, short: 65.4064, long: 48.9994 };

function ease(param: AudioParam, target: number, now: number, seconds = 0.65) {
  // Holding the current value makes repeated mute/mode changes click-free.
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
  else {
    const value = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(value, now);
  }
  param.setTargetAtTime(target, now, seconds);
}

function colorAudio(audio: ObservatoryAudio, { enabled, running, mode }: AudioOptions) {
  const { context, master, voices, filter, noiseGain } = audio;
  const now = context.currentTime;
  window.clearTimeout(audio.suspendTimer);
  const fundamental = pitches[mode];
  voices.forEach((voice, index) => ease(voice.frequency, fundamental * [1, 1.5, 2][index], now, 1.5));
  ease(filter.frequency, mode === 'focus' ? 640 : mode === 'short' ? 1350 : 900, now, 1.8);
  ease(noiseGain.gain, mode === 'focus' ? 0.032 : mode === 'short' ? 0.055 : 0.045, now, 1.8);
  ease(master.gain, enabled ? (running ? 0.13 : 0.055) : 0, now, 0.2);
  if (!enabled) {
    audio.suspendTimer = window.setTimeout(() => {
      if (context.state === 'running') void context.suspend().catch(() => undefined);
    }, 1500);
  }
}

function createAudio(): ObservatoryAudio | null {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  let pendingContext: AudioContext | null = null;
  try {
    const context = new AudioContextClass();
    pendingContext = context;
    const master = context.createGain();
    master.gain.value = 0;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 35;
    highpass.Q.value = 0.3;
    master.connect(highpass).connect(context.destination);

    const voices = [1, 1.5, 2].map((ratio, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = 55 * ratio;
      const gain = context.createGain();
      gain.gain.value = [0.24, 0.085, 0.09][index];
      const pan = context.createStereoPanner();
      pan.pan.value = [-0.32, 0.4, -0.1][index];
      oscillator.connect(gain).connect(pan).connect(master);

      // Very slow detuning gives the sustained voices a living, floating quality.
      const drift = context.createOscillator();
      drift.frequency.value = [0.027, 0.019, 0.013][index];
      const depth = context.createGain();
      depth.gain.value = [3, 5, 4][index];
      drift.connect(depth).connect(oscillator.detune);
      drift.start();
      oscillator.start();
      return oscillator;
    });

    const buffer = context.createBuffer(2, context.sampleRate * 8, context.sampleRate);
    let seed = 1977;
    for (let channel = 0; channel < 2; channel++) {
      const samples = buffer.getChannelData(channel);
      let brown = 0;
      for (let sample = 0; sample < samples.length; sample++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        const white = (seed >>> 0) / 2147483648 - 1;
        brown = (brown + 0.018 * white) / 1.018;
        samples[sample] = brown * 3;
      }
      // A short seam fade makes the loop inaudible even through headphones.
      const seam = Math.floor(context.sampleRate * 0.08);
      for (let sample = 0; sample < seam; sample++) {
        const weight = sample / seam;
        samples[sample] *= weight;
        samples[samples.length - 1 - sample] *= weight;
      }
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 640;
    filter.Q.value = 0.25;
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0.032;
    noise.connect(filter).connect(noiseGain).connect(master);
    noise.start();
    return { context, master, voices, filter, noiseGain };
  } catch {
    // A partially supported browser should not retain an abandoned audio device.
    if (pendingContext) void pendingContext.close().catch(() => undefined);
    return null;
  }
}

function chime(audio: ObservatoryAudio, mode: Mode) {
  const { context, master } = audio;
  if (context.state !== 'running') return;
  const start = context.currentTime + 0.025;
  const notes = mode === 'long' ? [329.6276, 493.8833, 659.2551] : [293.6648, 440, 587.3295];
  notes.forEach((frequency, note) => {
    [1, 2.003, 3.008].forEach((partial, index) => {
      const tone = context.createOscillator();
      tone.type = 'sine';
      tone.frequency.value = frequency * partial;
      const gain = context.createGain();
      const at = start + note * 0.24;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime([0.3, 0.06, 0.018][index], at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 3.2 - index * 0.65);
      const pan = context.createStereoPanner();
      pan.pan.value = (note - 1) * 0.32;
      tone.connect(gain).connect(pan).connect(master);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); pan.disconnect(); };
      tone.start(at);
      tone.stop(at + 3.3);
    });
  });
}

/** Audio is created exclusively from unlock(), called inside a user gesture. */
export function useObservatoryAudio(options: AudioOptions): { unlock: () => void } {
  const audioRef = useRef<ObservatoryAudio | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const lastCompletion = useRef(options.completion);

  const unlock = useCallback(() => {
    if (!audioRef.current) audioRef.current = createAudio();
    const audio = audioRef.current;
    if (!audio) return;
    window.clearTimeout(audio.suspendTimer);
    // resume() is intentionally invoked synchronously within the click handler.
    void audio.context.resume().then(() => colorAudio(audio, optionsRef.current)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (audioRef.current) colorAudio(audioRef.current, options);
  }, [options.enabled, options.running, options.mode]);

  useEffect(() => {
    const changed = options.completion > lastCompletion.current;
    lastCompletion.current = options.completion;
    if (changed && options.enabled && audioRef.current) chime(audioRef.current, options.mode);
  }, [options.completion, options.enabled, options.mode]);

  useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) {
      window.clearTimeout(audio.suspendTimer);
      void audio.context.close().catch(() => undefined);
      audioRef.current = null;
    }
  }, []);

  return { unlock };
}
