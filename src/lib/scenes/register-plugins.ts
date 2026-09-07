import { registerScenePlugin } from "./registry";
import { emptyScenePlugin } from "@/scenes/empty";

let registered = false;

export function ensurePluginsRegistered() {
  if (registered) return;
  registerScenePlugin(emptyScenePlugin);
  registered = true;
}
