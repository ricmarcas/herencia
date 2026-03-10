"use client";

import { useEffect, useRef } from "react";

export default function HomeHeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const tryPlay = () => {
      const video = videoRef.current;
      if (!video) return;
      void video.play().catch(() => {
        // iOS may block autoplay until first user interaction.
      });
    };

    tryPlay();
    document.addEventListener("touchstart", tryPlay, { once: true });
    document.addEventListener("click", tryPlay, { once: true });
    document.addEventListener("visibilitychange", tryPlay);

    return () => {
      document.removeEventListener("touchstart", tryPlay);
      document.removeEventListener("click", tryPlay);
      document.removeEventListener("visibilitychange", tryPlay);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src="/videos/barbacoa.mp4"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      className="h-56 w-full object-cover md:h-80"
    />
  );
}
