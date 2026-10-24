import { useRef, useState } from 'react';
import type { Mode, TimerStatus } from '../types';
const point=(r:number,a:number)=>({x:400+r*Math.sin(a*Math.PI/180),y:400-r*Math.cos(a*Math.PI/180)});
export default function Orrery({remainingMs,progress,mode,status,reducedMotion,cycle,task,durationMs}:{remainingMs:number;progress:number;mode:Mode;status:TimerStatus;reducedMotion:boolean;cycle:number;task:string;durationMs:number}) {
 const [rotation,setRotation]=useState(0);const drag=useRef<{x:number;r:number}|null>(null);
 const seconds=Math.max(0,Math.ceil(remainingMs/1000));
 const time=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
 const phase=mode==='focus'?'FOCUS SESSION':mode==='short'?'SHORT BREAK':'LONG BREAK';
 return <div className={`orrery ${status} ${mode} ${reducedMotion?'still':''}`} onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,r:rotation};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(drag.current)setRotation(drag.current.r+(e.clientX-drag.current.x)*.12)}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
  <div className="instrument-halo"/>{status==='running'&&<div className="ignition-wave"/>}
  <svg className="instrument" viewBox="0 0 800 800" aria-hidden="true" style={{'--nudge':`${rotation}deg`} as React.CSSProperties}>
   <defs>
    <radialGradient id="coreGlow"><stop stopColor="var(--light)" stopOpacity=".12"/><stop offset=".5" stopColor="var(--light)" stopOpacity=".025"/><stop offset="1" stopColor="var(--light)" stopOpacity="0"/></radialGradient>
    <radialGradient id="planetGold" cx="30%" cy="25%"><stop stopColor="#f4dfaa"/><stop offset=".26" stopColor="#c39a55"/><stop offset=".65" stopColor="#79562b"/><stop offset="1" stopColor="#1a1715"/></radialGradient>
    <radialGradient id="planetMoon" cx="28%" cy="24%"><stop stopColor="#e6f6f5"/><stop offset=".35" stopColor="#acc6cc"/><stop offset=".7" stopColor="#465961"/><stop offset="1" stopColor="#101c25"/></radialGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#77603b"/><stop offset=".28" stopColor="#e8ce8b"/><stop offset=".5" stopColor="#685436"/><stop offset=".78" stopColor="#c39c56"/><stop offset="1" stopColor="#4e442f"/></linearGradient>
    <linearGradient id="orbitLight"><stop stopColor="#c89b4a" stopOpacity=".08"/><stop offset=".4" stopColor="#d5ba7a" stopOpacity=".7"/><stop offset=".7" stopColor="#c89b4a" stopOpacity=".3"/><stop offset="1" stopColor="#c89b4a" stopOpacity=".1"/></linearGradient>
    <filter id="shine" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="soft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="12"/></filter>
    <path id="topLabel" d="M 198,218 A 272,272 0 0,1 602,218"/>
   </defs>
   <circle cx="400" cy="400" r="350" fill="url(#coreGlow)"/>
   <g className="coordinate-lines" stroke="#9aa6b2" strokeWidth=".5" opacity=".15"><path d="M400 42v124M400 634v124M42 400h124M634 400h124"/><path d="m153 153 46 46m402 402 46 46M153 647l46-46m402-402 46-46"/><circle cx="400" cy="400" r="330" fill="none" strokeDasharray="1 9"/></g>
   <g className="orbital-assembly">
    <g className="tilt-orbit orbit-one"><ellipse cx="400" cy="400" rx="355" ry="191" transform="rotate(-32 400 400)" fill="none" stroke="url(#orbitLight)" strokeWidth="1.1"/><ellipse cx="400" cy="400" rx="359" ry="195" transform="rotate(-32 400 400)" fill="none" stroke="#c89b4a" opacity=".09" strokeWidth=".6"/><path d="M129 576 671 224" stroke="#c89b4a" strokeWidth=".6" opacity=".18"/><g className="outer-planet"><circle cx="127" cy="566" r="22" fill="#c89b4a" opacity=".1" filter="url(#soft)"/><circle cx="127" cy="566" r="14" fill="url(#planetGold)"/><circle cx="127" cy="566" r="18" fill="none" stroke="#c89b4a" strokeWidth=".5" opacity=".5"/></g></g>
    <g className="tilt-orbit orbit-two"><ellipse cx="400" cy="400" rx="330" ry="190" transform="rotate(42 400 400)" fill="none" stroke="#8b9da5" strokeWidth=".7" opacity=".32"/><ellipse cx="400" cy="400" rx="323" ry="185" transform="rotate(42 400 400)" fill="none" stroke="#c89b4a" strokeWidth=".5" opacity=".15"/><circle cx="603" cy="620" r="6" fill="url(#planetGold)"/><circle cx="183" cy="181" r="3" fill="#bfcacc"/><circle cx="183" cy="181" r="10" fill="none" stroke="#a9b8bf" strokeWidth=".4" opacity=".5"/></g>
    <circle cx="400" cy="400" r="285" fill="none" stroke="#c89b4a" opacity=".13" strokeWidth=".6"/>
    <circle cx="400" cy="400" r="272" fill="none" stroke="url(#brass)" strokeWidth="1.4"/>
    <circle cx="400" cy="400" r="267" fill="none" stroke="#c89b4a" strokeWidth=".5" opacity=".35"/>
    <g className="calibration-ticks">{Array.from({length:120},(_,i)=>{const a=point(i%10===0?250:i%5===0?255:259,i*3),b=point(265,i*3);return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={i%10===0?'#dac590':'#a98a52'} strokeWidth={i%10===0?1:.6} opacity={i%5===0?.8:.4}/>})}</g>
    <g fill="#a8a394" fontFamily="monospace" fontSize="10" letterSpacing="1">{Array.from({length:12},(_,i)=>{const p=point(295,i*30);return <text key={i} x={p.x} y={p.y+3} textAnchor="middle">{(i*5).toString().padStart(2,'0')}</text>})}</g>
    <circle cx="400" cy="400" r="242" fill="none" stroke="#c89b4a" strokeWidth=".6" opacity=".22"/>
    <circle cx="400" cy="400" r="233" fill="none" stroke="#c89b4a" strokeWidth="3" opacity=".04"/>
    <circle cx="400" cy="400" r="233" fill="none" stroke="var(--light)" strokeWidth="1.7" strokeDasharray={`${Math.max(.002,1-progress)*1464} 1464`} transform="rotate(-90 400 400)" className="session-track"/>
    <circle cx="400" cy="400" r="224" fill="none" stroke="#9aa6b2" strokeWidth=".5" strokeDasharray="2 6" opacity=".25"/>
    <circle cx="400" cy="400" r="211" fill="none" stroke="var(--light)" strokeWidth=".7" opacity=".42" strokeDasharray={`${(1-((durationMs-remainingMs)%60000)/60000)*1325.75} 1325.75`} transform="rotate(-90 400 400)"/><g className="inner-orbit"><ellipse cx="400" cy="400" rx="206" ry="204" fill="none" stroke="#c89b4a" opacity=".14" strokeWidth=".6"/><circle cx="400" cy="194" r="3.2" fill="var(--light)"/><circle cx="400" cy="194" r="8" fill="var(--light)" filter="url(#shine)" opacity=".8"/><circle cx="400" cy="606" r="2" fill="#c89b4a"/></g>
    <g className="moon-orbit"><circle cx="400" cy="400" r="309" fill="none" stroke="#a9c2cb" strokeWidth=".4" strokeDasharray="1 13" opacity=".2"/><circle cx="676" cy="261" r="26" fill="#8fd3ff" filter="url(#soft)" opacity=".07"/><circle cx="676" cy="261" r="17" fill="url(#planetMoon)"/><circle cx="671" cy="255" r="3" fill="#596f75" opacity=".3"/><circle cx="678" cy="263" r="4" fill="#53666c" opacity=".2"/></g>
   </g>
   <g fill="#9b957e" fontFamily="monospace" fontSize="8" letterSpacing="3"><text x="400" y="53" textAnchor="middle">TEMPUS · ORBITA · INTENTIO</text><text x="400" y="753" textAnchor="middle">PRECISION IN THE PRESENT</text></g>
   <g className="crosshair" stroke="#c89b4a" strokeWidth=".7" opacity=".5"><path d="M390 99h20m-10-10v20M390 701h20m-10-10v20M99 390v20m-10-10h20M701 390v20m-10-10h20"/></g>
  </svg>
  <div className="timer-face">
   <span className="timer-mode"><i/>{phase}</span>
   <div className="timer-digits" role="timer" aria-label={`${Math.floor(seconds/60)} minutes ${seconds%60} seconds remaining`}>{time}</div>
   <span className="timer-caption">{status==='running'?(mode==='focus'?'FOCUS WINDOW OPEN':'RETURN WHEN READY'):status==='paused'?'ORBIT ON HOLD':'YOUR NEXT ORBIT AWAITS'}</span>
   <div className="timer-divider"/><span className="timer-cycle">ORBIT {String(cycle).padStart(2,'0')} <span> / </span> {mode==='focus'?'DEEP WORK':'REST & RECALIBRATE'}</span>{task&&<span className="instrument-mission">{task}</span>}
  </div>
  <span className="instrument-coordinate left-coordinate">RA 23h 56m<br/><span>+ 41° 08′</span></span><span className="instrument-coordinate right-coordinate">EST. 2026<br/><span>INSTRUMENT № 001</span></span>
 </div>
}
