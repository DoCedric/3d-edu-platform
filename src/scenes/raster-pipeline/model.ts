import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MeshData } from "./pipeline";

export const MODELS = [
  { id: "suzanne", label: "Suzanne", url: "/models/Suzanne.glb" },
  { id: "suzanne-low", label: "Suzanne (low poly)", url: "/models/Suzanne_low.glb" },
  { id: "cube", label: "Cube", url: "/models/Cube.glb" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

/** Bounding-sphere radius after loading, in world units: small enough that
 * any rotation stays between the scene camera's near and far planes. */
const MODEL_RADIUS = 1.45;

const cache = new Map<ModelId, Promise<MeshData>>();

export function loadModel(id: ModelId): Promise<MeshData> {
  let promise = cache.get(id);
  if (!promise) {
    promise = load(MODELS.find((m) => m.id === id)!.url);
    promise.catch(() => cache.delete(id));
    cache.set(id, promise);
  }
  return promise;
}

/** Loads a GLB and turns it into plain triangle lists for the software
 * rasterizer. UVs are dropped and corners that share both position and
 * normal are merged, so the vertex count is what the GPU really processes:
 * a smooth surface shares its vertices, while hard edges (like a cube's)
 * keep one copy per face. */
async function load(url: string): Promise<MeshData> {
  const gltf = await new GLTFLoader().loadAsync(url);
  let source: THREE.BufferGeometry | null = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((child) => {
    if (!source && child instanceof THREE.Mesh) source = (child.geometry as THREE.BufferGeometry).clone().applyMatrix4(child.matrixWorld);
  });
  if (!source) throw new Error(`No mesh found in ${url}`);
  const loaded = source as THREE.BufferGeometry;
  if (!loaded.getAttribute("normal")) loaded.computeVertexNormals();

  const stripped = new THREE.BufferGeometry();
  stripped.setAttribute("position", loaded.getAttribute("position"));
  stripped.setAttribute("normal", loaded.getAttribute("normal"));
  stripped.setIndex(loaded.getIndex());
  const geometry = mergeVertices(stripped.index ? stripped : stripped.toNonIndexed());

  // Centre and scale so it fits the scene camera's view nicely.
  geometry.computeBoundingBox();
  geometry.translate(...geometry.boundingBox!.getCenter(new THREE.Vector3()).negate().toArray());
  geometry.computeBoundingSphere();
  const scale = MODEL_RADIUS / geometry.boundingSphere!.radius;
  geometry.scale(scale, scale, scale);

  const positions = new Float32Array(geometry.getAttribute("position").array);
  const normals = new Float32Array(geometry.getAttribute("normal").array);
  const indices = Uint32Array.from(geometry.getIndex()!.array);
  return { positions, normals, indices, vertexCount: positions.length / 3, triangleCount: indices.length / 3 };
}
