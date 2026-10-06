"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export const MODEL_URL = "/models/Suzanne.glb";
useGLTF.preload(MODEL_URL);

export interface PbrMaterialValues {
  color: string;
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
  emissive: string;
  emissiveIntensity: number;
  transmission: number;
  ior: number;
}

interface PbrPlaygroundSceneProps {
  values: PbrMaterialValues;
}

/** Suzanne's GLB carries geometry only (no material of its own), so a single
 * MeshPhysicalMaterial is created once and driven imperatively from
 * `values`, then applied to every mesh found by traversing the loaded
 * scene - robust regardless of how the GLB's nodes happen to be named. */
export function PbrPlaygroundScene({ values }: PbrPlaygroundSceneProps) {
  const { scene } = useGLTF(MODEL_URL);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const material = useMemo(() => new THREE.MeshPhysicalMaterial(), []);

  // three.js's transmission model refracts by casting a ray of length
  // `thickness * ior` through the surface and sampling what's behind it
  // (see transmission_pars_fragment.glsl.js: getVolumeTransmissionRay) - at
  // MeshPhysicalMaterial's default thickness of 0 that ray has zero length,
  // so IOR has no visible effect at all regardless of its value. Treating
  // Suzanne as solid glass means a ray can travel roughly its own bounding
  // radius before exiting the other side, so thickness is derived from the
  // model's actual size (half its bounding-box diagonal) instead of left at
  // the default - set once here rather than exposed as a control, since
  // it's a property of the geometry, not something a student is meant to
  // tune directly.
  const thickness = useMemo(() => new THREE.Box3().setFromObject(clonedScene).getSize(new THREE.Vector3()).length() / 2, [clonedScene]);

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) child.material = material;
    });
  }, [clonedScene, material]);

  useEffect(() => {
    // A three.js material is a plain mutable object by design - this whole
    // block updates it in place, the standard way to drive one. Forcing
    // needsUpdate on every change is cheap, and avoids a repeat of the
    // flatShading-style "the property changed but the compiled shader
    // didn't" bug from the shading-techniques demo.
    material.color.set(values.color);
    // eslint-disable-next-line react-hooks/immutability
    material.roughness = values.roughness;
    material.metalness = values.metalness;
    material.envMapIntensity = values.envMapIntensity;
    material.clearcoat = values.clearcoat;
    material.clearcoatRoughness = values.clearcoatRoughness;
    material.emissive.set(values.emissive);
    material.emissiveIntensity = values.emissiveIntensity;
    material.transmission = values.transmission;
    material.ior = values.ior;
    material.thickness = thickness;
    material.needsUpdate = true;
  }, [material, values, thickness]);

  return <primitive object={clonedScene} />;
}
