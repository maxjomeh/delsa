'use client';
import {useEffect} from 'react';
import {motion,useReducedMotion} from 'motion/react';
export function HomepageEffects(){useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||window.matchMedia('(pointer: coarse)').matches)return;let instance;let active=true;import('locomotive-scroll').then(({default:LocomotiveScroll})=>{if(!active)return;instance=new LocomotiveScroll({lenisOptions:{smoothWheel:true,lerp:.09}})}).catch(()=>{});return()=>{active=false;instance?.destroy?.()}},[]);return null}
export function HeroHeadline({children}){const reduced=useReducedMotion();return <motion.div initial={reduced?false:{opacity:0,y:35}} animate={{opacity:1,y:0}} transition={{duration:.85,ease:[.22,1,.36,1]}}>{children}</motion.div>}
