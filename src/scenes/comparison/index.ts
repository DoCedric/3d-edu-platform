import { ScenePlugin } from "@/lib/scenes/types";
import { ComparisonScene } from "./ComparisonScene";

export const comparisonScenePlugin: ScenePlugin = {
  id: "comparison",
  title: "Comparison Scene",
  description: "Two material variants shown side-by-side or toggled individually.",
  component: ComparisonScene,
  controls: [
    {
      id: "viewMode",
      type: "dropdown",
      label: "View Mode",
      options: ["side-by-side", "variant-a", "variant-b"],
      defaultValue: "side-by-side",
    },
    { id: "color", type: "color", label: "Color", defaultValue: "#4f8ef7" },
  ],
};
