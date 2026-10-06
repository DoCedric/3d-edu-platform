"use client";

import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, OrbitControls } from "@react-three/drei";
import { useState } from "react";
import { PbrPlaygroundScene, type PbrMaterialValues } from "@/scenes/pbr-playground/PbrPlaygroundScene";

const ENVIRONMENT_URL = "/hdri/meadow_2_1k.exr";

const DEFAULT_VALUES: PbrMaterialValues = {
  color: "#d9d9d9",
  roughness: 0.3,
  metalness: 0,
  envMapIntensity: 1,
  clearcoat: 0,
  clearcoatRoughness: 0.1,
  emissive: "#000000",
  emissiveIntensity: 1,
  transmission: 0,
  ior: 1.5,
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function SliderRow({ label, value, min, max, step, onChange }: SliderRowProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
        <span>{label}</span>
        <span className="font-mono text-text">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </div>
  );
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-text-muted">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
        />
      </div>
    </div>
  );
}

/** Standalone, chrome-free page meant to be embedded (e.g. as an iframe in a
 * Superhuman doc) rather than navigated to inside the lesson shell. */
export default function PbrPlaygroundEmbedPage() {
  const [values, setValues] = useState<PbrMaterialValues>(DEFAULT_VALUES);
  const [environmentRotationDeg, setEnvironmentRotationDeg] = useState(0);
  const environmentRotation: [number, number, number] = [0, (environmentRotationDeg * Math.PI) / 180, 0];

  function setValue<K extends keyof PbrMaterialValues>(key: K, value: PbrMaterialValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <div className="relative h-full min-w-0 flex-1">
        <Canvas camera={{ fov: 40 }}>
          {/* backgroundRotation and environmentRotation are kept in sync so
           * the visible panorama always matches what's reflected in the
           * material - rotating just one would make them disagree. */}
          <Environment files={ENVIRONMENT_URL} background backgroundRotation={environmentRotation} environmentRotation={environmentRotation} />
          <Bounds fit clip observe margin={1.4}>
            <PbrPlaygroundScene values={values} />
          </Bounds>
          <OrbitControls makeDefault />
        </Canvas>

        <div className="absolute top-3 left-3 max-w-[260px] rounded-md border border-border bg-bg-elevated/90 px-4 py-3 text-text shadow-lg backdrop-blur">
          <div className="text-xs leading-snug text-text-muted">The material can be adjusted on the right.</div>
        </div>

        <div className="absolute bottom-3 left-3 right-3 rounded-md border border-border bg-bg-elevated/90 px-4 py-3 text-text shadow-lg backdrop-blur">
          <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
            <span>Environment rotation</span>
            <span className="font-mono text-text">{environmentRotationDeg.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={environmentRotationDeg}
            onChange={(event) => setEnvironmentRotationDeg(Number(event.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="h-full w-[300px] shrink-0 overflow-y-auto border-l border-border bg-bg-elevated p-6">
        <div className="flex flex-col gap-5">
          <SliderRow label="Metalness" value={values.metalness} min={0} max={1} step={0.01} onChange={(v) => setValue("metalness", v)} />
          <SliderRow label="Roughness" value={values.roughness} min={0} max={1} step={0.01} onChange={(v) => setValue("roughness", v)} />
          <ColorRow label="Color" value={values.color} onChange={(v) => setValue("color", v)} />
          <SliderRow
            label="Environment reflection"
            value={values.envMapIntensity}
            min={0}
            max={3}
            step={0.05}
            onChange={(v) => setValue("envMapIntensity", v)}
          />
          <SliderRow label="Clearcoat" value={values.clearcoat} min={0} max={1} step={0.01} onChange={(v) => setValue("clearcoat", v)} />
          <SliderRow
            label="Clearcoat roughness"
            value={values.clearcoatRoughness}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setValue("clearcoatRoughness", v)}
          />
          <ColorRow label="Emissive" value={values.emissive} onChange={(v) => setValue("emissive", v)} />
          <SliderRow
            label="Emissive intensity"
            value={values.emissiveIntensity}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => setValue("emissiveIntensity", v)}
          />
          <SliderRow
            label="Transmission"
            value={values.transmission}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setValue("transmission", v)}
          />
          <SliderRow label="IOR" value={values.ior} min={1} max={2.333} step={0.01} onChange={(v) => setValue("ior", v)} />
        </div>
      </div>
    </div>
  );
}
