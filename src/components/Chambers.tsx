import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { Machine, Settings, Star } from '../types';
import './chambers.css';

type ChamberProps = { machine: Machine; onClose: () => void };

function CloseButton({ onClose }: { onClose: () => void }) {
  return <button className="chamber-close" onClick={onClose} aria-label="Close chamber"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg><span>ESC</span></button>;
}

function ChamberHeading({ index, eyebrow, title, onClose }: { index: string; eyebrow: string; title: string; onClose: () => void }) {
  return <header className="chamber-header"><div><p className="chamber-eyebrow"><span>{index}</span><span className="chamber-label-line" />{eyebrow}</p><h2>{title}</h2></div><CloseButton onClose={onClose} /></header>;
}

function Stepper({ label, detail, value, min, max, unit, onChange }: { label: string; detail: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit(next: number) {
    const safe = Math.min(max, Math.max(min, Math.round(Number.isFinite(next) ? next : value)));
    setDraft(String(safe));
    onChange(safe);
  }
  return <div className="calibration-row"><div className="calibration-copy"><label htmlFor={id}>{label}</label><span>{detail}</span></div><div className="instrument-stepper"><button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onClick={() => commit(value - 1)}>−</button><div className="stepper-value"><input id={id} type="number" inputMode="numeric" min={min} max={max} step="1" value={draft} onChange={event => { const next = event.target.value; setDraft(next); if (next !== '' && Number.isInteger(Number(next)) && Number(next) >= min && Number(next) <= max) onChange(Number(next)); }} onBlur={() => commit(Number(draft))} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><span>{unit}</span></div><button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= max} onClick={() => commit(value + 1)}>+</button></div></div>;
}

function PreferenceSwitch({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: () => void }) {
  const id = useId();
  return <div className="preference-row"><div><span id={id}>{label}</span><p>{description}</p></div><button className="chamber-switch" type="button" role="switch" aria-checked={value} aria-labelledby={id} onClick={onChange}><span /></button></div>;
}

export function SettingsChamber({ machine, onClose, onAudioUnlock }: ChamberProps & { onAudioUnlock?: () => void }) {
  const titleId = useId();
  const update = (key: keyof Settings) => (value: number) => machine.updateSettings({ [key]: value });
  return <section className="chamber settings-chamber" role="dialog" aria-modal="true" aria-label="Instrument settings" aria-describedby={titleId}>
    <ChamberHeading index="02" eyebrow="INSTRUMENT CALIBRATION" title="Find your rhythm." onClose={onClose} />
    <p className="chamber-intro" id={titleId}>A little structure. A little space.<br />Calibrate the machine to the way you work.</p>
    <div className="calibration-section"><div className="chamber-section-label"><span>01 / THE CYCLE</span><span>MINUTES</span></div>
      <Stepper label="Focus window" detail="Time for undivided attention" value={machine.settings.focus} min={1} max={120} unit="MIN" onChange={update('focus')} />
      <Stepper label="Short rest" detail="A small distance from your work" value={machine.settings.short} min={1} max={60} unit="MIN" onChange={update('short')} />
      <Stepper label="Long rest" detail="Room to return renewed" value={machine.settings.long} min={1} max={120} unit="MIN" onChange={update('long')} />
      <Stepper label="Sessions per cycle" detail="Focus windows before a long rest" value={machine.settings.cycles} min={1} max={12} unit="ORBITS" onChange={update('cycles')} />
    </div>
    <p className="calibration-note"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 7v4M8 4.5v.5" /></svg>Your active session keeps its original duration. New values apply to future phases.</p>
    <div className="chamber-section-label preference-label"><span>02 / THE ATMOSPHERE</span></div>
    <PreferenceSwitch label="Observatory sound" description="A quiet hum during a session, a chime at completion." value={machine.settings.sound} onChange={() => { onAudioUnlock?.(); machine.updateSettings({ sound: !machine.settings.sound }); }} />
    <PreferenceSwitch label="Reduced motion" description="Still the moving rings and soften visual effects." value={machine.settings.reducedMotion} onChange={() => machine.updateSettings({ reducedMotion: !machine.settings.reducedMotion })} />
    <footer className="chamber-footer"><span className={`persistence-light ${machine.storageAvailable ? '' : 'is-unavailable'}`} /><span>{machine.storageAvailable ? 'CALIBRATION SAVED IN THIS BROWSER' : 'STORAGE UNAVAILABLE · SAVED FOR THIS VISIT'}</span><span className="chamber-footer-mark">O//1</span></footer>
  </section>;
}

function seed(text: string) {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return (n >>> 0) / 4294967295;
}

function dateKey(time: number) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function readableDate(time: number) {
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function archiveStats(archive: Star[]) {
  const days = new Map<string, { count: number; minutes: number; time: number }>();
  let totalMinutes = 0;
  archive.forEach(star => {
    const key = dateKey(star.completedAt);
    const day = days.get(key) ?? { count: 0, minutes: 0, time: star.completedAt };
    day.count++;
    day.minutes += star.durationMinutes;
    totalMinutes += star.durationMinutes;
    days.set(key, day);
  });
  let streak = 0;
  const cursor = new Date();
  if (!days.has(dateKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dateKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const bestDay = [...days.values()].sort((a, b) => b.count - a.count || b.minutes - a.minutes || b.time - a.time)[0];
  return { totalMinutes, streak, bestDay };
}

type SkyStar = Star & { x: number; y: number; radius: number; day: string };

function chartStars(archive: Star[]): SkyStar[] {
  const groupCounts = new Map<string, number>();
  return [...archive].sort((a, b) => a.completedAt - b.completedAt).map(star => {
    const day = dateKey(star.completedAt);
    const index = groupCounts.get(day) ?? 0;
    groupCounts.set(day, index + 1);
    const angle = index * 2.399963 + seed(day) * Math.PI * 2;
    const distance = Math.min(115, Math.sqrt(index) * 23);
    return { ...star, day, x: Math.min(850, Math.max(50, 135 + seed(day + 'x') * 630 + Math.cos(angle) * distance)), y: Math.min(325, Math.max(45, 90 + seed(day + 'y') * 200 + Math.sin(angle) * distance)), radius: Math.min(5.2, 2.3 + Math.sqrt(star.durationMinutes) * .24) };
  });
}

function exportArchive(archive: Star[]) {
  const json = JSON.stringify({ instrument: 'ORRERY//ONE', version: 1, exportedAt: new Date().toISOString(), stars: archive }, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `orrery-one-stars-${dateKey(Date.now())}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VaultChamber({ machine, onClose }: ChamberProps) {
  const skyId = useId().replace(/:/g, '');
  const [selectedId, setSelectedId] = useState<string | null>(machine.archive[machine.archive.length - 1]?.id ?? null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const starButtons = useRef(new Map<string, SVGGElement>());
  const stars = useMemo(() => chartStars(machine.archive), [machine.archive]);
  const stats = useMemo(() => archiveStats(machine.archive), [machine.archive]);
  const selected = stars.find(star => star.id === (hoverId ?? selectedId));
  const constellations = useMemo(() => {
    const groups = new Map<string, SkyStar[]>();
    stars.forEach(star => groups.set(star.day, [...(groups.get(star.day) ?? []), star]));
    return [...groups.entries()];
  }, [stars]);
  useEffect(() => {
    if (!selectedId || !machine.archive.some(star => star.id === selectedId)) setSelectedId(machine.archive[machine.archive.length - 1]?.id ?? null);
  }, [machine.archive, selectedId]);
  function navigateStars(event: KeyboardEvent<SVGGElement>, index: number) {
    let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % stars.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + stars.length) % stars.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = stars.length - 1;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(stars[index].id); }
    if (next !== undefined) { event.preventDefault(); setSelectedId(stars[next].id); starButtons.current.get(stars[next].id)?.focus(); }
  }
  function startPan(event: PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest('[data-earned-star]')) return;
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }
  function movePan(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const scale = 900 / event.currentTarget.getBoundingClientRect().width;
    setPan({ x: Math.max(-450, Math.min(450, drag.current.panX + (event.clientX - drag.current.x) * scale)), y: Math.max(-190, Math.min(190, drag.current.panY + (event.clientY - drag.current.y) * scale)) });
  }
  function endPan() { drag.current = null; setIsDragging(false); }
  return <section className="chamber vault-chamber" role="dialog" aria-modal="true" aria-label="Constellation vault">
    <ChamberHeading index="01" eyebrow="THE MACHINE REMEMBERS" title="A sky of your own." onClose={onClose} />
    <div className="vault-intro-line"><p className="chamber-intro">Every finished focus window, a point of light.</p><span className="vault-coordinate">PRIVATE OBSERVATORY / LOCAL SKY</span></div>
    <div className="vault-sky-frame">
      <div className="sky-topline"><span><i />{stars.length ? 'RECORDED CONSTELLATIONS' : 'AN UNWRITTEN SKY'}</span><span>{String(stars.length).padStart(3, '0')} STARS</span></div>
      <svg className={`vault-sky ${isDragging ? 'is-dragging' : ''}`} viewBox="0 0 900 370" aria-label={`${stars.length} earned focus stars. Use the arrow keys to explore stars, or drag the sky to pan.`} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
        <defs><radialGradient id={`${skyId}-nebula`}><stop offset="0" stopColor="#8FD3FF" stopOpacity=".075" /><stop offset="1" stopColor="#8FD3FF" stopOpacity="0" /></radialGradient><filter id={`${skyId}-glow`} x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3" /></filter></defs>
        <ellipse cx="450" cy="190" rx="370" ry="170" fill={`url(#${skyId}-nebula)`} />
        <g className="sky-coordinate-lines" aria-hidden="true"><path d="M0 185h900M450 0v370" /><ellipse cx="450" cy="185" rx="340" ry="145" /><ellipse cx="450" cy="185" rx="170" ry="145" /><ellipse cx="450" cy="185" rx="340" ry="72" /></g>
        <g className="ambient-stars" aria-hidden="true">{Array.from({ length: 68 }, (_, i) => <circle key={i} cx={seed(`${i}ambient-x`) * 900} cy={seed(`${i}ambient-y`) * 370} r={.4 + seed(`${i}ambient-r`) * .7} opacity={.14 + seed(`${i}ambient-a`) * .4} />)}</g>
        <g transform={`translate(${450 + pan.x} ${185 + pan.y}) scale(${zoom}) translate(-450 -185)`}>
          <g className="constellation-lines" aria-hidden="true">{constellations.filter(([, points]) => points.length > 1).map(([day, points]) => <polyline key={day} points={points.map(star => `${star.x},${star.y}`).join(' ')} />)}</g>
          {stars.map((star, index) => { const active = star.id === (hoverId ?? selectedId); return <g key={star.id} ref={node => { if (node) starButtons.current.set(star.id, node); else starButtons.current.delete(star.id); }} data-earned-star="true" className={`earned-star ${active ? 'is-selected' : ''}`} role="button" tabIndex={star.id === selectedId || (!selectedId && index === stars.length - 1) ? 0 : -1} aria-label={`${star.task || 'Untitled focus'}, ${star.durationMinutes} minutes, ${readableDate(star.completedAt)}`} aria-pressed={star.id === selectedId} onFocus={() => setSelectedId(star.id)} onClick={() => setSelectedId(star.id)} onMouseEnter={() => setHoverId(star.id)} onMouseLeave={() => setHoverId(null)} onKeyDown={event => navigateStars(event, index)}>
            <circle className="earned-star-target" cx={star.x} cy={star.y} r="15" />
            <circle className="earned-star-halo" cx={star.x} cy={star.y} r={star.radius * 2.5} filter={`url(#${skyId}-glow)`} />
            <circle className="earned-star-selection" cx={star.x} cy={star.y} r={star.radius + 9} />
            <path className="earned-star-cross" d={`M${star.x - star.radius * 2.3} ${star.y}h${star.radius * 4.6}M${star.x} ${star.y - star.radius * 2.3}v${star.radius * 4.6}`} />
            <circle className="earned-star-core" cx={star.x} cy={star.y} r={star.radius * .72} />
          </g>; })}
        </g>
      </svg>
      {!stars.length && <div className="vault-empty"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="18" /><path d="M26 0v15m0 22v15M0 26h15m22 0h15M20 26h12m-6-6v12" /></svg><h3>Your first star is waiting.</h3><p>Complete a focus session to leave a light here.<br />This sky is built from your work.</p></div>}
      <div className="sky-bottomline"><span><i />{stars.length ? 'GOLD POINTS ARE COMPLETED FOCUS SESSIONS' : 'BACKGROUND STARS ARE AMBIENT ONLY'}</span><div className="sky-controls"><button onClick={() => setZoom(value => Math.max(.75, value - .25))} disabled={zoom <= .75} aria-label="Zoom out of star archive">−</button><button className="sky-zoom-reset" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset star archive view">{Math.round(zoom * 100)}%</button><button onClick={() => setZoom(value => Math.min(3, value + .25))} disabled={zoom >= 3} aria-label="Zoom into star archive">+</button></div></div>
    </div>
    <div className={`star-record ${selected ? 'has-record' : ''}`} aria-live="polite" aria-atomic="true"><div className="star-record-symbol" aria-hidden="true">✧</div>{selected ? <><div className="star-record-main"><span className="chamber-micro-label">FOCUS RECORD / {String(stars.findIndex(star => star.id === selected.id) + 1).padStart(3, '0')}</span><h3>{selected.task || 'An untitled focus window'}</h3>{selected.note && <p className="star-record-note">{selected.note}</p>}</div><div className="star-record-meta"><span>{selected.durationMinutes}<small>MINUTES</small></span><time dateTime={new Date(selected.completedAt).toISOString()}>{readableDate(selected.completedAt)}<br />{new Date(selected.completedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</time></div></> : <div className="star-record-main"><span className="chamber-micro-label">NO OBSERVATIONS RECORDED</span><p>The machine will remember your finished focus sessions.</p></div>}</div>
    <div className="vault-stats"><div><span className="stat-value">{machine.archive.length.toLocaleString()}</span><span className="stat-label">STARS RECORDED</span></div><div><span className="stat-value">{Math.round(stats.totalMinutes).toLocaleString()}<small>m</small></span><span className="stat-label">TIME IN FOCUS</span></div><div><span className="stat-value">{stats.streak}<small>{stats.streak === 1 ? 'day' : 'days'}</small></span><span className="stat-label">CURRENT STREAK</span></div><div><span className="stat-value">{stats.bestDay ? stats.bestDay.count : '—'}{stats.bestDay && <small>{stats.bestDay.count === 1 ? 'star' : 'stars'}</small>}</span><span className="stat-label">{stats.bestDay ? `BEST DAY · ${new Date(stats.bestDay.time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase()}` : 'BEST DAY · YET TO COME'}</span></div></div>
    <footer className="chamber-footer vault-footer"><span className="persistence-light" /><span>{machine.storageAvailable ? 'YOUR SKY LIVES IN THIS BROWSER' : 'BROWSER STORAGE IS UNAVAILABLE'}</span><button className="archive-export" onClick={() => exportArchive(machine.archive)}>EXPORT SKY <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m-3-3 3 3 3-3M3 10v3h10v-3" /></svg></button></footer>
  </section>;
}

export function AboutChamber({ onClose }: { onClose: () => void }) {
  return <section className="chamber about-chamber" role="dialog" aria-modal="true" aria-label="About ORRERY ONE">
    <ChamberHeading index="03" eyebrow="NOTES FROM THE OBSERVATORY" title="Give time a shape." onClose={onClose} />
    <div className="about-orbit" aria-hidden="true"><div /><div /><div /><span>✦</span><i /></div>
    <p className="about-lede">An orrery gives the invisible<br />a little room to move.</p>
    <p className="about-body">This one measures attention. Set a focus window, give it a task, and begin. The outer orbit traces the whole session; the inner orbit traces each minute. After a few revolutions, step away. Return when ready.</p>
    <div className="about-archive-note"><span>✧</span><p>Every completed focus session becomes a star in your private sky. Over time, a record of the work only you could do.</p></div>
    <div className="about-shortcuts"><span className="chamber-section-label">AT YOUR FINGERTIPS</span><div><span>Start / pause</span><kbd>SPACE</kbd></div><div><span>Immersive mode</span><kbd>F</kbd></div><div><span>Close a chamber</span><kbd>ESC</kbd></div></div>
    <footer className="chamber-footer"><span className="persistence-light" /><span>NO ACCOUNTS. NO CLOUD. JUST YOUR CORNER OF THE COSMOS.</span></footer>
  </section>;
}
