import { ScenePlugin } from "@/lib/scenes/types";
import { BasicCameraScene } from "./BasicCameraScene";

export const basicCameraScenePlugin: ScenePlugin = {
  id: "camera",
  title: "Basic Camera Scene",
  description: "A row of cubes at varying depth, demonstrating perspective vs orthographic projection.",
  component: BasicCameraScene,
  controls: [
    {
      id: "projection",
      type: "dropdown",
      label: "Projection",
      options: ["perspective", "orthographic"],
      defaultValue: "perspective",
    },
  ],
};
