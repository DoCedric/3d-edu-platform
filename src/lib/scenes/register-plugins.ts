import { registerScenePlugin } from "./registry";
import { emptyScenePlugin } from "@/scenes/empty";
import { basicLightingScenePlugin } from "@/scenes/basic-lighting";
import { materialsScenePlugin } from "@/scenes/materials";
import { basicCameraScenePlugin } from "@/scenes/camera";
import { comparisonScenePlugin } from "@/scenes/comparison";
import { movingInSpaceScenePlugin } from "@/scenes/moving-in-space";

let registered = false;

export function ensurePluginsRegistered() {
  if (registered) return;
  registerScenePlugin(emptyScenePlugin);
  registerScenePlugin(basicLightingScenePlugin);
  registerScenePlugin(materialsScenePlugin);
  registerScenePlugin(basicCameraScenePlugin);
  registerScenePlugin(comparisonScenePlugin);
  registerScenePlugin(movingInSpaceScenePlugin);
  registered = true;
}
