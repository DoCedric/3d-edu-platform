"use client";

import { useEffect, useState } from "react";
import { Viewport } from "@/components/viewport/Viewport";
import { ComparisonFramework } from "@/components/comparison/ComparisonFramework";
import { ensurePluginsRegistered } from "@/lib/scenes/register-plugins";
import { getScenePlugin } from "@/lib/scenes/registry";

const BLUE_METALLIC = { color: "#4f8ef7", metalness: 0.9, roughness: 0.1 };
const RED_ROUGH = { color: "#d94f4f", metalness: 0.05, roughness: 0.9 };

export default function ComparisonFrameworkDemoPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensurePluginsRegistered();
    setReady(true);
  }, []);

  const plugin = ready ? getScenePlugin("materials") : undefined;
  const SceneComponent = plugin?.component;

  if (!ready || !SceneComponent) return null;

  return (
    <div className="w-screen h-screen">
      <ComparisonFramework
        leftLabel="Blue metallic"
        rightLabel="Red rough"
        left={
          <Viewport>
            <SceneComponent controlValues={BLUE_METALLIC} />
          </Viewport>
        }
        right={
          <Viewport>
            <SceneComponent controlValues={RED_ROUGH} />
          </Viewport>
        }
      />
    </div>
  );
}
