import { useEffect, useRef } from "react";

function positionsMatch(a: [number, number, number], b: [number, number, number], tolerance: number): boolean {
  return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance && Math.abs(a[2] - b[2]) <= tolerance;
}

/** Generic position-matching / success signal. Compares a current position
 * against a target within a tolerance and fires `onMatch` once per
 * transition into a matched state (re-arms if the position moves away and
 * back). Carries no notion of what "solved" means beyond "positions equal" -
 * callers decide what to do with the signal (e.g. mark a lesson complete). */
export function useTargetMatch(
  position: [number, number, number],
  target: [number, number, number],
  tolerance = 0.001,
  onMatch?: () => void
): boolean {
  const matched = positionsMatch(position, target, tolerance);
  const firedRef = useRef(false);
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;

  useEffect(() => {
    if (matched) {
      if (!firedRef.current) {
        firedRef.current = true;
        onMatchRef.current?.();
      }
    } else {
      firedRef.current = false;
    }
  }, [matched]);

  return matched;
}
