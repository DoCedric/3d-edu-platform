import { registerScenePlugin } from "./registry";
import { emptyScenePlugin } from "@/scenes/empty";
import { basicLightingScenePlugin } from "@/scenes/basic-lighting";
import { materialsScenePlugin } from "@/scenes/materials";

let registered = false;

export function ensurePluginsRegistered() {
  if (registered) return;
  registerScenePlugin(emptyScenePlugin);
  registerScenePlugin(basicLightingScenePlugin);
  registerScenePlugin(materialsScenePlugin);
  registered = true;
}
