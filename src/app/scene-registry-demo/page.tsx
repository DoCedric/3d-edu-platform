"use client";

import { useEffect, useState } from "react";
import { Viewport } from "@/components/viewport/Viewport";
import { ensurePluginsRegistered } from "@/lib/scenes/register-plugins";
import { getScenePlugin, getAllScenePlugins } from "@/lib/scenes/registry";
import { useControlValues } from "@/lib/scenes/useControlValues";
import { useAnnotationSelection } from "@/lib/scenes/useAnnotationSelection";
import { ControlsPanel } from "@/components/controls/ControlsPanel";
import { AnnotationSidebar } from "@/components/annotations/AnnotationSidebar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function SceneRegistryDemoPage() {
  const [sceneType, setSceneType] = useState("empty");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensurePluginsRegistered();
    setReady(true);
  }, []);

  const plugin = ready ? getScenePlugin(sceneType) : undefined;
  const allPlugins = ready ? getAllScenePlugins() : [];
  const SceneComponent = plugin?.component;
  const { values, setValue } = useControlValues(plugin?.controls);
  const { selectedId, hoveredId, focusToken, select, hover } = useAnnotationSelection(plugin?.id);

  if (!ready) return null;

  const hasControls = !!plugin?.controls && plugin.controls.length > 0;
  const hasAnnotations = !!plugin?.annotations && plugin.annotations.length > 0;

  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="flex items-center gap-3 p-3 border-b border-border bg-bg-elevated z-10">
        <span className="text-text-muted text-sm">sceneType:</span>
        {allPlugins.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={sceneType === p.id ? "primary" : "secondary"}
            onClick={() => setSceneType(p.id)}
          >
            {p.title}
          </Button>
        ))}
        {plugin && <Badge variant="accent">{plugin.description}</Badge>}
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative min-w-0">
          {SceneComponent ? (
            <Viewport
              annotations={plugin?.annotations}
              selectedAnnotationId={selectedId}
              hoveredAnnotationId={hoveredId}
              annotationFocusToken={focusToken}
              onAnnotationSelect={select}
              onAnnotationHover={hover}
            >
              <SceneComponent controlValues={values} />
            </Viewport>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted">
              No scene plugin found for sceneType &quot;{sceneType}&quot;
            </div>
          )}
        </div>
        {(hasAnnotations || hasControls) && (
          <div className="w-[280px] shrink-0 border-l border-border bg-bg-elevated overflow-y-auto flex flex-col">
            {hasAnnotations && plugin?.annotations && (
              <AnnotationSidebar
                annotations={plugin.annotations}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={select}
                onHover={hover}
              />
            )}
            {hasControls && plugin?.controls && (
              <ControlsPanel controls={plugin.controls} values={values} onChange={setValue} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
