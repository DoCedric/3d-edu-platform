"use client";

import { useEffect, useState } from "react";
import { Viewport } from "@/components/viewport/Viewport";
import { ensurePluginsRegistered } from "@/lib/scenes/register-plugins";
import { getScenePlugin, getAllScenePlugins } from "@/lib/scenes/registry";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function SceneRegistryDemoPage() {
  const [sceneType, setSceneType] = useState("empty");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensurePluginsRegistered();
    setReady(true);
  }, []);

  if (!ready) return null;

  const plugin = getScenePlugin(sceneType);
  const allPlugins = getAllScenePlugins();
  const SceneComponent = plugin?.component;

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
      <div className="flex-1">
        {SceneComponent ? (
          <Viewport>
            <SceneComponent />
          </Viewport>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            No scene plugin found for sceneType &quot;{sceneType}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
