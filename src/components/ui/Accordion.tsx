"use client";

import { ReactNode, useState } from "react";

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2 bg-bg-elevated text-text text-sm font-medium"
      >
        {title}
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="px-4 py-3 text-text-muted text-sm">{children}</div>}
    </div>
  );
}
