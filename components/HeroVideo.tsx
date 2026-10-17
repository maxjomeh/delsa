"use client";

import { useEffect, useState } from "react";

const videoSource =
  "https://videos.pexels.com/video-files/30712136/13139557_1920_1080_25fps.mp4";

export default function HeroVideo() {
  const [shouldPlay, setShouldPlay] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setShouldPlay(!preference.matches);

    syncPreference();
    preference.addEventListener("change", syncPreference);
    return () => preference.removeEventListener("change", syncPreference);
  }, []);

  if (!shouldPlay) {
    return <div className="cinematic-video cinematic-video-fallback" aria-hidden="true" />;
  }

  return (
    <video
      className="cinematic-video"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      onError={(event) => {
        event.currentTarget.style.opacity = "0";
      }}
    >
      <source src={videoSource} type="video/mp4" />
    </video>
  );
}
