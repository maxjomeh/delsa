'use client';
import {useI18n} from './i18n/I18nProvider';
import {useRef} from 'react';
// Floating 3D book cover for the cinematic template (hero and book-of-the-week). The cover drifts
// slowly (CSS) and tilts towards the pointer; both are disabled for coarse pointers and for
// prefers-reduced-motion (see builder-templates.css). Without an image a typographic cover is drawn.
export default function BuilderFloatingCover({src,alt='',title=''}){
 const {t,intl}=useI18n();
 const ref=useRef(null);
 function move(e){
  if(e.pointerType==='touch')return;
  const el=ref.current;if(!el)return;
  const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
  el.style.setProperty('--ry',(x*22).toFixed(1)+'deg');el.style.setProperty('--rx',(-y*16).toFixed(1)+'deg');
 }
 function leave(){const el=ref.current;if(!el)return;el.style.removeProperty('--ry');el.style.removeProperty('--rx')}
 return <div className="ds-cover" data-part="floating-cover" ref={ref} onPointerMove={move} onPointerLeave={leave}>
  <div data-part="cover-book">
   {src?<img src={src} alt={alt} referrerPolicy="no-referrer"/>:<span data-part="cover-fallback" aria-hidden="true"><b>{title||alt||t('کتاب')}</b></span>}
   <i data-part="cover-spine" aria-hidden="true"/>
  </div>
  <u data-part="cover-shadow" aria-hidden="true"/>
 </div>;
}
