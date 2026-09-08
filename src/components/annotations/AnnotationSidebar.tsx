"use client";

import { SceneAnnotationSchema } from "@/lib/scenes/types";

interface AnnotationSidebarProps {
  annotations: SceneAnnotationSchema[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function AnnotationSidebar({ annotations, selectedId, hoveredId, onSelect, onHover }: AnnotationSidebarProps) {
  return (
    <div className="flex flex-col gap-1 p-4 border-b border-border">
      <span className="text-sm text-text-muted mb-1">Annotations</span>
      {annotations.map((annotation) => {
        const selected = annotation.id === selectedId;
        const hovered = annotation.id === hoveredId;
        return (
          <button
            key={annotation.id}
            onClick={() => onSelect(annotation.id)}
            onMouseEnter={() => onHover(annotation.id)}
            onMouseLeave={() => onHover(null)}
            className={`text-left text-sm rounded-md px-2 py-1.5 transition-colors border ${
              selected
                ? "bg-accent text-accent-foreground border-accent"
                : hovered
                ? "bg-bg-elevated text-text border-border"
                : "bg-transparent text-text border-transparent hover:bg-bg-elevated"
            }`}
          >
            {annotation.label}
          </button>
        );
      })}
    </div>
  );
}
