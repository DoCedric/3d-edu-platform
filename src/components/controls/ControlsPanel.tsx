"use client";

import { SceneControlSchema, SceneControlValues } from "@/lib/scenes/types";

interface ControlsPanelProps {
  controls: SceneControlSchema[];
  values: SceneControlValues;
  onChange: (id: string, value: number | boolean | string) => void;
  onButtonPress?: (id: string) => void;
}

export function ControlsPanel({ controls, values, onChange, onButtonPress }: ControlsPanelProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {controls.map((control) => {
        if (control.type === "slider") {
          const value = (values[control.id] as number) ?? control.defaultValue;
          return (
            <div key={control.id} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span className="text-text">{control.label}</span>
                <span className="text-text-muted">{value.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={value}
                onChange={(e) => onChange(control.id, parseFloat(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
          );
        }

        if (control.type === "checkbox") {
          const value = (values[control.id] as boolean) ?? control.defaultValue;
          return (
            <label key={control.id} className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => onChange(control.id, e.target.checked)}
                className="accent-accent"
              />
              {control.label}
            </label>
          );
        }

        if (control.type === "dropdown") {
          const value = (values[control.id] as string) ?? control.defaultValue;
          return (
            <div key={control.id} className="flex flex-col gap-1">
              <span className="text-sm text-text">{control.label}</span>
              <select
                value={value}
                onChange={(e) => onChange(control.id, e.target.value)}
                className="bg-bg-elevated border border-border rounded-sm text-text text-sm p-1.5"
              >
                {control.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          );
        }

        if (control.type === "color") {
          const value = (values[control.id] as string) ?? control.defaultValue;
          return (
            <div key={control.id} className="flex items-center justify-between gap-2">
              <span className="text-sm text-text">{control.label}</span>
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(control.id, e.target.value)}
                className="w-10 h-8 rounded-sm border border-border bg-transparent"
              />
            </div>
          );
        }

        if (control.type === "button") {
          return (
            <button
              key={control.id}
              onClick={() => onButtonPress?.(control.id)}
              className="rounded-md bg-accent text-accent-foreground text-sm px-3 py-1.5"
            >
              {control.label}
            </button>
          );
        }

        return null;
      })}
    </div>
  );
}
