"use client";

import { useEffect, useState } from "react";
import { LessonLayout } from "@/components/layouts/LessonLayout";
import { Viewport } from "@/components/viewport/Viewport";
import { ensurePluginsRegistered } from "@/lib/scenes/register-plugins";
import { getScenePlugin } from "@/lib/scenes/registry";
import { useControlValues } from "@/lib/scenes/useControlValues";
import { useAnnotationSelection } from "@/lib/scenes/useAnnotationSelection";
import { ControlsPanel } from "@/components/controls/ControlsPanel";
import { AnnotationSidebar } from "@/components/annotations/AnnotationSidebar";
import { TheoryShelf } from "@/components/theory/TheoryShelf";
import { MdxContent } from "@/components/theory/MdxContent";
import { Toolbar } from "@/components/ui/Toolbar";
import { Badge } from "@/components/ui/Badge";

const PLACEHOLDER_THEORY = `# Theory Shelf Placeholder

This is a **placeholder** snippet proving the Theory Shelf can render
Markdown/MDX — it is not real lesson content.

## What this proves

The shelf renders headings, paragraphs, lists, and code blocks with
distinct formatting instead of raw text.

- Collapsible via the tab on its edge
- Resizable by dragging its left edge
- Animated open/close and resize
- Has zero knowledge of the scene, controls, or annotations it sits next to

\`\`\`txt
placeholder code block — not real lesson content
\`\`\`

> This panel only knows how to render Markdown/MDX.
`;

export default function TheoryShelfDemoPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensurePluginsRegistered();
    setReady(true);
  }, []);

  const plugin = ready ? getScenePlugin("materials") : undefined;
  const SceneComponent = plugin?.component;
  const { values, setValue } = useControlValues(plugin?.controls);
  const { selectedId, hoveredId, focusToken, select, hover } = useAnnotationSelection(plugin?.id);

  if (!ready || !plugin || !SceneComponent) return null;

  const hasControls = !!plugin.controls && plugin.controls.length > 0;
  const hasAnnotations = !!plugin.annotations && plugin.annotations.length > 0;

  return (
    <LessonLayout
      shelfChrome={false}
      toolbar={
        <Toolbar>
          <Badge variant="accent">{plugin.title}</Badge>
          <Badge>{plugin.description}</Badge>
        </Toolbar>
      }
      viewport={
        <div className="flex w-full h-full">
          <div className="flex-1 relative min-w-0">
            <Viewport
              annotations={plugin.annotations}
              selectedAnnotationId={selectedId}
              hoveredAnnotationId={hoveredId}
              annotationFocusToken={focusToken}
              onAnnotationSelect={select}
              onAnnotationHover={hover}
            >
              <SceneComponent controlValues={values} />
            </Viewport>
          </div>
          {(hasAnnotations || hasControls) && (
            <div className="w-[280px] shrink-0 border-l border-border bg-bg-elevated overflow-y-auto flex flex-col">
              {hasAnnotations && plugin.annotations && (
                <AnnotationSidebar
                  annotations={plugin.annotations}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  onSelect={select}
                  onHover={hover}
                />
              )}
              {hasControls && plugin.controls && (
                <ControlsPanel controls={plugin.controls} values={values} onChange={setValue} />
              )}
            </div>
          )}
        </div>
      }
      shelf={
        <TheoryShelf title="Theory">
          <MdxContent source={PLACEHOLDER_THEORY} />
        </TheoryShelf>
      }
    />
  );
}
