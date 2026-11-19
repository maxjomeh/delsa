'use client';
import {useEffect,useLayoutEffect,useRef} from 'react';
// Survives client-side route changes (the whole page remounts on navigation, so state on the DOM
// root would be lost). Once the visitor has followed a link, later page mounts fade in.
let navigated=false;
// Arms scroll-reveal for [data-reveal] items of the surrounding site. Items start visible (so the
// server-rendered/cached HTML never hides content); only items below the fold are switched to
// "pending" after hydration and revealed as they enter the viewport. Skipped entirely when the
// operating system asks for reduced motion or IntersectionObserver is unavailable.
export default function BuilderMotion(){
 const ref=useRef(null);
 // Before paint, so the page-level fade starts together with the new content.
 useLayoutEffect(()=>{if(navigated)ref.current?.closest('[data-delsa-site]')?.setAttribute('data-nav','')},[]);
 useEffect(()=>{
  const root=ref.current?.closest('[data-delsa-site]');
  if(!root||typeof IntersectionObserver==='undefined'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const io=new IntersectionObserver(entries=>{for(const e of entries){/* also reveal items already scrolled past (fast scroll / anchor jumps) */if(!e.isIntersecting&&e.boundingClientRect.top>=0)continue;io.unobserve(e.target);e.target.setAttribute('data-reveal','visible')}},{threshold:.12,rootMargin:'0px 0px -6% 0px'});
  const settled=e=>{if(e.propertyName==='opacity'&&e.target.getAttribute?.('data-reveal')==='visible')e.target.setAttribute('data-reveal','done')};
  const arm=el=>{if(el.getAttribute('data-reveal')!=='')return;if(el.getBoundingClientRect().top<window.innerHeight*.92){el.setAttribute('data-reveal','done');return}el.setAttribute('data-reveal','pending');io.observe(el)};
  const scan=node=>{if(node.nodeType!==1)return;if(node.hasAttribute('data-reveal'))arm(node);node.querySelectorAll('[data-reveal]').forEach(arm)};
  const followed=()=>{navigated=true};
  const linkClick=e=>{if(e.target.closest?.('a[href]'))followed()};
  root.addEventListener('click',linkClick,true);
  window.addEventListener('popstate',followed);
  root.addEventListener('transitionend',settled);
  // Statistics count up from zero the first time they scroll into view (numbers keep their digits, prefix and suffix).
  const FA='۰۱۲۳۴۵۶۷۸۹',parts=/^(\D*?)([0-9۰-۹][0-9۰-۹,٬.]*)(.*)$/s;
  const countIO=new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting)continue;countIO.unobserve(e.target);const el=e.target,m=parts.exec(el.textContent||'');if(!m)continue;
   const persian=/[۰-۹]/.test(m[2]),target=Number(m[2].replace(/[۰-۹]/g,d=>FA.indexOf(d)).replace(/[,٬]/g,''));if(!Number.isFinite(target)||target<=0||target>1e9)continue;
   const fmt=n=>(persian?new Intl.NumberFormat('fa-IR',{useGrouping:/[,٬]/.test(m[2])}):new Intl.NumberFormat('en',{useGrouping:/,/.test(m[2])})).format(Math.round(n)),start=performance.now(),dur=1400;
   const tick=t=>{const k=Math.min(1,(t-start)/dur),ease=1-Math.pow(1-k,3);el.textContent=m[1]+fmt(target*ease)+m[3];if(k<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)}},{threshold:.4});
  root.querySelectorAll('[data-block="stats"] dd').forEach(el=>countIO.observe(el));
  scan(root);
  root.setAttribute('data-motion-ready','');
  const mo=new MutationObserver(list=>list.forEach(m=>m.addedNodes.forEach(scan)));
  mo.observe(root,{childList:true,subtree:true});
  return()=>{countIO.disconnect();io.disconnect();mo.disconnect();root.removeEventListener('transitionend',settled);root.removeEventListener('click',linkClick,true);window.removeEventListener('popstate',followed);root.removeAttribute('data-motion-ready');root.querySelectorAll('[data-reveal]').forEach(el=>el.setAttribute('data-reveal',''))};
 },[]);
 return <span ref={ref} hidden/>;
}
