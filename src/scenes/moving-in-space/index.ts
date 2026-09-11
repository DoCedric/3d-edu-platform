import { ScenePlugin } from "@/lib/scenes/types";
import { MovingInSpaceScene } from "./MovingInSpaceScene";

export const movingInSpaceScenePlugin: ScenePlugin = {
  id: "moving-in-space",
  title: "Moving in Space",
  description: "Drag the cube along the X axis until it reaches the target position.",
  component: MovingInSpaceScene,
  cameraPosition: [6, 4.5, 7],
  controls: [{ id: "resetSignal", type: "button", label: "Reset position" }],
};
