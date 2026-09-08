"use client";

import { ReactNode, useCallback, useRef, useState } from "react";
import { Toolbar } from "@/components/ui/Toolbar";
import { Button } from "@/components/ui/Button";

type ComparisonMode = "slider" | "split" | "toggle";

interface ComparisonFrameworkProps {
  left: ReactNode;
  right: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  defaultMode?: ComparisonMode;
}

export function ComparisonFramework({
  left,
  right,
  leftLabel = "A",
  rightLabel = "B",
  defaultMode = "slider",
}: ComparisonFrameworkProps) {
  const [mode, setMode] = useState<ComparisonMode>(defaultMode);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [toggleSide, setToggleSide] = useState<"left" | "right">("left");
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDividerPointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const updateFromClientX = (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = ((clientX - rect.left) / rect.width) * 100;
      setSliderPosition(Math.min(100, Math.max(0, ratio)));
    };

    updateFromClientX(event.clientX);

    const handleMove = (moveEvent: PointerEvent) => updateFromClientX(moveEvent.clientX);
    const handleUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, []);

  return (
    <div className="flex flex-col w-full h-full bg-bg">
      <div className="border-b border-border px-3 py-2">
        <Toolbar>
          <Button size="sm" variant={mode === "slider" ? "primary" : "secondary"} onClick={() => setMode("slider")}>
            Slider
          </Button>
          <Button size="sm" variant={mode === "split" ? "primary" : "secondary"} onClick={() => setMode("split")}>
            Split
          </Button>
          <Button size="sm" variant={mode === "toggle" ? "primary" : "secondary"} onClick={() => setMode("toggle")}>
            Toggle
          </Button>
          {mode === "toggle" && (
            <Button size="sm" variant="ghost" onClick={() => setToggleSide((side) => (side === "left" ? "right" : "left"))}>
              Showing: {toggleSide === "left" ? leftLabel : rightLabel} (switch)
            </Button>
          )}
        </Toolbar>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {mode === "split" ? (
          <div className="flex w-full h-full">
            <div className="flex-1 relative min-w-0 overflow-hidden border-r border-border">{left}</div>
            <div className="flex-1 relative min-w-0 overflow-hidden">{right}</div>
          </div>
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={
                mode === "toggle"
                  ? {
                      opacity: toggleSide === "right" ? 1 : 0,
                      pointerEvents: toggleSide === "right" ? "auto" : "none",
                    }
                  : undefined
              }
            >
              {right}
            </div>
            <div
              className="absolute inset-0"
              style={
                mode === "slider"
                  ? { clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }
                  : {
                      opacity: toggleSide === "left" ? 1 : 0,
                      pointerEvents: toggleSide === "left" ? "auto" : "none",
                    }
              }
            >
              {left}
            </div>

            {mode === "slider" && (
              <div
                className="absolute top-0 bottom-0 z-10 flex items-center justify-center"
                style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
              >
                <div className="w-0.5 h-full bg-accent" />
                <button
                  type="button"
                  onPointerDown={handleDividerPointerDown}
                  aria-label="Drag to compare"
                  className="absolute w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center cursor-ew-resize shadow-md text-xs"
                >
                  ⇔
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
