'use client';

import { useEffect, useRef } from 'react';

/** Decorative pseudo-3D chat bubble (Zdog). Pauses off-screen, stays still for reduced motion, draggable. */
export default function Zdog3D() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let cancelled = false;
    let onScreen = true;
    let io: IntersectionObserver | undefined;

    (async () => {
      const Zdog = (await import('zdog')).default as any;
      if (cancelled) return;
      let swaying = true;
      const orange = '#ff5a1f';
      const cream = '#fbf7ef';
      const illo = new Zdog.Illustration({
        element: canvas,
        zoom: 1.12,
        dragRotate: true,
        onDragStart: () => { swaying = false; },
        onDragEnd: () => { swaying = true; },
      });

      // chat bubble: front + back slabs give it volume
      for (const z of [-12, 12]) {
        new Zdog.RoundedRect({ addTo: illo, width: 104, height: 70, cornerRadius: 24, stroke: 16, color: orange, fill: true, translate: { z } });
      }
      new Zdog.Shape({ addTo: illo, path: [{ x: -34, y: 36 }, { x: -52, y: 66 }, { x: -6, y: 40 }], stroke: 14, color: orange, fill: true });
      for (const x of [-26, 0, 26]) {
        new Zdog.Ellipse({ addTo: illo, diameter: 8, stroke: 9, color: cream, translate: { x, y: 0, z: 26 } });
      }
      // orbiting coin + check badge
      const coin = new Zdog.Group({ addTo: illo, translate: { x: 86, y: -58, z: 20 } });
      new Zdog.Ellipse({ addTo: coin, diameter: 34, stroke: 8, color: '#ffb36b', fill: true });
      new Zdog.Shape({ addTo: coin, path: [{ y: -7 }, { y: 7 }], stroke: 5, color: '#a84a0b', translate: { z: 5 } });
      const badge = new Zdog.Group({ addTo: illo, translate: { x: -84, y: 58, z: 24 } });
      new Zdog.Ellipse({ addTo: badge, diameter: 36, stroke: 8, color: '#52d68f', fill: true });
      new Zdog.Shape({ addTo: badge, path: [{ x: -8, y: 1 }, { x: -2, y: 8 }, { x: 10, y: -7 }], closed: false, stroke: 5, color: '#0b3a22', translate: { z: 6 } });

      illo.rotate.y = -0.45;
      illo.rotate.x = -0.12;
      const render = () => illo.updateRenderGraph();
      render();
      if (reduce) return;

      io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; });
      io.observe(canvas);
      let t = 0;
      const tick = () => {
        if (onScreen) {
          t += 0.018;
          if (swaying) {
            illo.rotate.y = Math.sin(t) * 0.7;
            illo.rotate.x = -0.12 + Math.sin(t * 0.7) * 0.08;
          }
          coin.rotate.y += 0.05;
          coin.translate.y = -58 + Math.sin(t * 1.6) * 6;
          badge.translate.y = 58 + Math.cos(t * 1.4) * 5;
          render();
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, []);

  return (
    <div className="hx-zdog" aria-hidden="true">
      <canvas ref={ref} width={260} height={260} />
    </div>
  );
}
