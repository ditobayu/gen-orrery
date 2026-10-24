import { useEffect, useRef } from 'react';
import type { Mode } from '../types';

interface StarfieldProps {
  reducedMotion: boolean;
  running: boolean;
  mode: Mode;
}

interface SkyStar {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  glint: boolean;
  warm: boolean;
}

const modes: Mode[] = ['focus', 'short', 'long'];
const atmospheres: Record<Mode, { color: string; horizon: string; x: number; radius: number; opacity: number }> = {
  focus: { color: '57, 47, 32', horizon: '33, 35, 39', x: 0.76, radius: 0.5, opacity: 0.27 },
  short: { color: '29, 67, 76', horizon: '26, 56, 61', x: 0.73, radius: 0.67, opacity: 0.34 },
  long: { color: '36, 47, 77', horizon: '29, 45, 69', x: 0.65, radius: 0.85, opacity: 0.37 },
};

function makeStars(count: number): SkyStar[] {
  let seed = 819;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, index) => ({
    x: random(), y: random(), radius: 0.32 + random() ** 3 * 1.05,
    alpha: 0.16 + random() * 0.5, phase: random() * Math.PI * 2,
    glint: index % 39 === 5, warm: random() > 0.72,
  }));
}

/** A quiet, deterministic sky. The instrument supplies the scene's bright light. */
export default function Starfield({ reducedMotion, running, mode }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const redrawRef = useRef<() => void>(() => undefined);
  const stateRef = useRef({ running, mode });
  stateRef.current = { running, mode };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: SkyStar[] = [];
    let frame = 0;
    let elapsed = 0;
    let lastTime = 0;
    let lastPaint = 0;
    let destroyed = false;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let systemReducedMotion = motionQuery.matches;
    const isStill = () => reducedMotion || systemReducedMotion;
    const weights: Record<Mode, number> = { focus: 0, short: 0, long: 0 };
    weights[stateRef.current.mode] = 1;
    // Only the haze is cached; three translucent fields can dissolve smoothly.
    const backdrops = Object.fromEntries(modes.map(skyMode => [skyMode, document.createElement('canvas')])) as Record<Mode, HTMLCanvasElement>;

    function paintBackground() {
      for (const skyMode of modes) {
        const backdrop = backdrops[skyMode];
        const background = backdrop.getContext('2d');
        if (!background) continue;
        backdrop.width = Math.round(width * dpr);
        backdrop.height = Math.round(height * dpr);
        background.setTransform(dpr, 0, 0, dpr, 0, 0);
        const atmosphere = atmospheres[skyMode];
        const haze = background.createRadialGradient(width * atmosphere.x, height * 0.46, 0, width * atmosphere.x, height * 0.46, width * atmosphere.radius);
        haze.addColorStop(0, `rgba(${atmosphere.color}, ${atmosphere.opacity})`);
        haze.addColorStop(0.45, `rgba(${atmosphere.color}, ${atmosphere.opacity * 0.5})`);
        haze.addColorStop(1, `rgba(${atmosphere.color}, 0)`);
        background.fillStyle = haze;
        background.fillRect(0, 0, width, height);
        const horizon = background.createRadialGradient(width * 0.89, height * 1.1, 0, width * 0.89, height * 1.1, height * (skyMode === 'long' ? 1.1 : 0.8));
        horizon.addColorStop(0, `rgba(${atmosphere.horizon}, 0.18)`);
        horizon.addColorStop(1, `rgba(${atmosphere.horizon}, 0)`);
        background.fillStyle = horizon;
        background.fillRect(0, 0, width, height);
      }
    }

    function paint() {
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = '#070b12';
      context.fillRect(0, 0, width, height);
      for (const skyMode of modes) {
        if (weights[skyMode] < 0.001) continue;
        context.globalAlpha = weights[skyMode];
        context.drawImage(backdrops[skyMode], 0, 0, width, height);
      }
      context.globalAlpha = 1;
      const { running: active, mode: currentMode } = stateRef.current;
      const intensity = active ? 1 : 0.8;
      const speed = currentMode === 'focus' ? 1 : currentMode === 'short' ? 0.62 : 0.4;
      const time = isStill() ? 0 : elapsed * speed;
      for (const star of stars) {
        const x = star.x * width + Math.sin(time * 0.015 + star.phase) * 2.2;
        const y = star.y * height + Math.cos(time * 0.012 + star.phase) * 1.3;
        const twinkle = isStill() ? 1 : 0.86 + Math.sin(time * 0.35 + star.phase) * 0.14;
        const alpha = star.alpha * twinkle * intensity;
        const color = star.warm ? '214, 199, 171' : '180, 202, 218';
        context.fillStyle = `rgba(${color}, ${alpha})`;
        context.beginPath();
        context.arc(x, y, star.radius, 0, Math.PI * 2);
        context.fill();
        if (star.glint) {
          const glow = context.createRadialGradient(x, y, 0, x, y, 7);
          glow.addColorStop(0, `rgba(${color}, ${alpha * 0.24})`);
          glow.addColorStop(1, `rgba(${color}, 0)`);
          context.fillStyle = glow;
          context.fillRect(x - 7, y - 7, 14, 14);
          context.strokeStyle = `rgba(${color}, ${alpha * 0.4})`;
          context.lineWidth = 0.5;
          const length = star.radius * 2 + 1.3;
          context.beginPath();
          context.moveTo(x - length, y);
          context.lineTo(x + length, y);
          context.moveTo(x, y - length);
          context.lineTo(x, y + length);
          context.stroke();
        }
      }
    }

    function animate(now: number) {
      if (destroyed || document.hidden || isStill()) return;
      const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
      elapsed += delta;
      // Exponential blending also handles a second mode change during a dissolve.
      for (const skyMode of modes) {
        const target = stateRef.current.mode === skyMode ? 1 : 0;
        weights[skyMode] += (target - weights[skyMode]) * (1 - Math.exp(-delta / 0.65));
      }
      lastTime = now;
      // This atmosphere needs only 30 fps; the orbital instrument stays independent.
      if (now - lastPaint > 32) { paint(); lastPaint = now; }
      frame = requestAnimationFrame(animate);
    }

    function resize() {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      stars = makeStars(Math.max(72, Math.min(220, Math.round(width * height / 6800))));
      paintBackground();
      paint();
    }

    function visibility() {
      cancelAnimationFrame(frame);
      lastTime = 0;
      if (!document.hidden) {
        paint();
        if (!isStill()) frame = requestAnimationFrame(animate);
      }
    }

    function motionPreferenceChanged(event: MediaQueryListEvent) {
      systemReducedMotion = event.matches;
      redraw();
      visibility();
    }

    function redraw() {
      if (isStill()) {
        for (const skyMode of modes) weights[skyMode] = stateRef.current.mode === skyMode ? 1 : 0;
        paint();
      }
    }

    redrawRef.current = redraw;
    resize();
    if (!isStill() && !document.hidden) frame = requestAnimationFrame(animate);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    motionQuery.addEventListener('change', motionPreferenceChanged);
    return () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      motionQuery.removeEventListener('change', motionPreferenceChanged);
      redrawRef.current = () => undefined;
    };
  }, [reducedMotion]);

  useEffect(() => { redrawRef.current(); }, [mode, running]);

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}
