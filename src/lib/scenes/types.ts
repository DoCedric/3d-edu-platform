import { ComponentType } from "react";

export type SceneControlSchema =
  | { id: string; type: "slider"; label: string; min: number; max: number; step: number; defaultValue: number }
  | { id: string; type: "checkbox"; label: string; defaultValue: boolean }
  | { id: string; type: "dropdown"; label: string; options: string[]; defaultValue: string }
  | { id: string; type: "color"; label: string; defaultValue: string }
  | { id: string; type: "button"; label: string };

export type SceneControlValues = Record<string, number | boolean | string>;

export interface SceneAnnotationSchema {
  id: string;
  label: string;
  position: [number, number, number];
  [key: string]: unknown;
}

export interface ScenePlugin {
  id: string;
  title: string;
  description: string;
  component: ComponentType<{ controlValues?: SceneControlValues; onControlEvent?: (id: string) => void }>;
  controls?: SceneControlSchema[];
  annotations?: SceneAnnotationSchema[];
}
