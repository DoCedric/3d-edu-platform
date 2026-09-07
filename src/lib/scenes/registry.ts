import { ScenePlugin } from "./types";

const registry = new Map<string, ScenePlugin>();

export function registerScenePlugin(plugin: ScenePlugin) {
  if (registry.has(plugin.id)) {
    console.warn(`Scene plugin "${plugin.id}" is already registered. Overwriting.`);
  }
  registry.set(plugin.id, plugin);
}

export function getScenePlugin(id: string): ScenePlugin | undefined {
  return registry.get(id);
}

export function getAllScenePlugins(): ScenePlugin[] {
  return Array.from(registry.values());
}
