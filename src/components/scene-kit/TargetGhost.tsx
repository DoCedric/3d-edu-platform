"use client";

import { ReactNode } from "react";

interface TargetGhostProps {
  position: [number, number, number];
  children: ReactNode;
}

/** Positions an arbitrary "ghost" visual at a target location. The visual
 * itself (wireframe, transparency, whatever reads as "ghost") is entirely up
 * to the caller via `children` - this component only knows about placement. */
export function TargetGhost({ position, children }: TargetGhostProps) {
  return <group position={position}>{children}</group>;
}
