import { ScenePlugin } from "@/lib/scenes/types";
import { EmptyScene } from "./EmptyScene";

export const emptyScenePlugin: ScenePlugin = {
  id: "empty",
  title: "Empty Scene",
  description: "A minimal placeholder scene demonstrating the plugin architecture.",
  component: EmptyScene,
};
