import { ScenePlugin } from "@/lib/scenes/types";
import { BasicLightingScene } from "./BasicLightingScene";

export const basicLightingScenePlugin: ScenePlugin = {
  id: "lighting",
  title: "Basic Lighting Scene",
  description: "Demonstrates two colored point lights on a sphere and ground plane.",
  component: BasicLightingScene,
};
