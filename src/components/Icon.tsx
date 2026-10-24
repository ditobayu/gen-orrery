import type { CSSProperties } from 'react';
export function Icon({name,size=18,style}:{name:string;size?:number;style?:CSSProperties}) {
 const paths:Record<string,React.ReactNode>={
  play:<path d="m9 5 11 7-11 7z"/>, pause:<><path d="M8 5v14M16 5v14"/></>, reset:<><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></>, skip:<><path d="m6 5 10 7-10 7zM19 5v14"/></>,
  settings:<><path d="M9.5 3h5l.7 3 2.6 1.5 3-.9 2.5 4.3-2.3 2.1v3l2.3 2.1-2.5 4.3-3-.9-2.6 1.5-.7 3h-5l-.7-3-2.6-1.5-3 .9L.7 18l2.3-2.1v-3L.7 10.8l2.5-4.3 3 .9L8.8 6z" transform="translate(2 0) scale(.8)"/><circle cx="12" cy="12" r="3"/></>,
  sound:<><path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16"/></>, muted:<><path d="m11 4-6 5H2v6h3l6 5zM16 9l6 6M22 9l-6 6"/></>, fullscreen:<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>, exit:<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/>, arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>, star:<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z"/>, note:<><path d="M5 4h14v16H5zM9 9h6M9 13h6"/></>, close:<path d="m6 6 12 12M18 6 6 18"/>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill={name==='play'?'currentColor':'none'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">{paths[name]||paths.star}</svg>
}
export function Mark({size=35}:{size?:number}) {return <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true"><circle cx="22" cy="22" r="14.5" stroke="currentColor" strokeWidth="1"/><ellipse cx="22" cy="22" rx="21" ry="7.5" transform="rotate(-42 22 22)" stroke="currentColor"/><path d="M22 3v38M3 22h38" stroke="currentColor" strokeWidth=".5" opacity=".35"/><circle cx="22" cy="22" r="3" fill="currentColor"/><circle cx="33.7" cy="11.8" r="2.2" fill="currentColor"/></svg>}
