"use client";

import type { PointerEvent, ReactNode } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
};

/** Cursor-tracked radial highlight, adapted from 21st.dev Spotlight Card patterns. */
export default function SpotlightCard({ children, className = "" }: SpotlightCardProps) {
  function updateSpotlight(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse") return;

    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
  }

  return (
    <article className={className} onPointerMove={updateSpotlight}>
      {children}
    </article>
  );
}
