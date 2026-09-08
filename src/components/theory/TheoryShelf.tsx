"use client";

import { ReactNode, useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";

interface TheoryShelfProps {
  children: ReactNode;
  title?: string;
  defaultOpen?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function TheoryShelf({
  children,
  title = "Theory",
  defaultOpen = true,
  defaultWidth = 360,
  minWidth = 240,
  maxWidth = 1120,
}: TheoryShelfProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef<{ pointerX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      dragStart.current = { pointerX: event.clientX, startWidth: width };
      setIsResizing(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragStart.current) return;
        const delta = dragStart.current.pointerX - moveEvent.clientX;
        const nextWidth = Math.min(maxWidth, Math.max(minWidth, dragStart.current.startWidth + delta));
        setWidth(nextWidth);
      };

      const handleUp = () => {
        dragStart.current = null;
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [width, minWidth, maxWidth]
  );

  return (
    <div className="flex h-full shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? `Collapse ${title} panel` : `Expand ${title} panel`}
        className="flex w-7 shrink-0 items-center justify-center border-l border-border bg-bg-elevated text-text-muted transition-colors hover:bg-border/30 hover:text-text"
      >
        <span className="text-xs leading-none">{open ? "›" : "‹"}</span>
      </button>

      <motion.div
        className="h-full overflow-hidden border-l border-border bg-bg-elevated"
        initial={false}
        animate={{ width: open ? width : 0 }}
        transition={isResizing ? { duration: 0 } : { duration: 0.28, ease: "easeInOut" }}
      >
        <div className="relative h-full" style={{ width }}>
          {open && (
            <div
              onPointerDown={handleResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label={`Resize ${title} panel`}
              className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-accent/50"
            />
          )}
          <div className="h-full overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-text">{title}</span>
            </div>
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
