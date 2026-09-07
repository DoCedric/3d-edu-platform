import { useState } from "react";
import { SceneControlSchema, SceneControlValues } from "./types";

export function useControlValues(controls: SceneControlSchema[] = []) {
  const [values, setValues] = useState<SceneControlValues>(() => {
    const initial: SceneControlValues = {};
    for (const control of controls) {
      if (control.type !== "button") {
        initial[control.id] = control.defaultValue;
      }
    }
    return initial;
  });

  const setValue = (id: string, value: number | boolean | string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  return { values, setValue };
}
