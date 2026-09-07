import { ScenePlugin } from "@/lib/scenes/types";
import { MaterialsScene } from "./MaterialsScene";

export const materialsScenePlugin: ScenePlugin = {
  id: "materials",
  title: "Materials Scene",
  description: "A sphere with adjustable color, metalness, and roughness, reflecting an HDRI environment.",
  component: MaterialsScene,
  controls: [
    { id: "color", type: "color", label: "Color", defaultValue: "#4f8ef7" },
    { id: "metalness", type: "slider", label: "Metalness", min: 0, max: 1, step: 0.01, defaultValue: 0.6 },
    { id: "roughness", type: "slider", label: "Roughness", min: 0, max: 1, step: 0.01, defaultValue: 0.25 },
  ],
};
