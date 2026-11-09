"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";

const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};
const noopSubscribe = () => () => {};

/** Fullscreen API state for a demo's root element. `enabled` is false e.g.
 * inside an iframe without allowfullscreen; hide the button then. */
export function useFullscreen(rootRef: RefObject<HTMLElement | null>) {
  const enabled = useSyncExternalStore(noopSubscribe, () => document.fullscreenEnabled, () => false);
  const active = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen();
  }, [rootRef]);

  return { enabled, active, toggle };
}

export function FullscreenIcon({ exit, className = "h-5 w-5" }: { exit: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {exit ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  );
}
