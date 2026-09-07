import { ComponentType } from "react";

export interface SceneControlSchema {
  id: string;
  type: "slider" | "checkbox" | "dropdown" | "color" | "button";
  label: string;
  [key: string]: unknown;
}

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
  component: ComponentType<Record<string, unknown>>;
  controls?: SceneControlSchema[];
  annotations?: SceneAnnotationSchema[];
}
