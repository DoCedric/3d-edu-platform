export interface DemoInfo {
  slug: string;
  title: string;
  description: string;
}

/** Every embeddable demo under src/app/embed/*, in display order. Adding a
 * new demo means adding one entry here - embed pages are client components,
 * which can't export Next.js route `metadata`, so there's no way to read a
 * nice title back out of the folder automatically. */
export const DEMOS: DemoInfo[] = [
  {
    slug: "coordinate-point",
    title: "Point Coordinates",
    description: "Drag a point along the X/Y/Z axes and watch its coordinates update live.",
  },
  {
    slug: "cube-coordinates",
    title: "Spatial Coordinates",
    description: "Move a cube through world space while its own local coordinates stay fixed - object vs. world space.",
  },
  {
    slug: "triangle-anatomy",
    title: "Triangle Anatomy",
    description: "Toggle a triangle's vertices, edges, and faces independently to see how a mesh is built up.",
  },
  {
    slug: "lambert-diffuse",
    title: "Lambert Diffuse Lighting",
    description: "Drag a light around a triangle to see its normal, light vector, angle, and the resulting diffuse shading.",
  },
  {
    slug: "lambert-diffuse-icosphere",
    title: "Lambert Diffuse (Icosphere)",
    description: "The same Lambert diffuse lesson, now computed per face across a full icosphere.",
  },
  {
    slug: "barycentric-coordinates",
    title: "Barycentric Coordinates & UV Sampling",
    description: "Hover a 3D triangle and its UV layout together to see how barycentric weights sample a texture.",
  },
  {
    slug: "shading-techniques",
    title: "Shading Techniques",
    description: "Compare flat, Gouraud, and Phong shading on the same low-poly sphere under a draggable light.",
  },
  {
    slug: "bit-depth",
    title: "Bit Depth & Dithering",
    description: "Reduce an image's bit depth and channel, with optional dithering, then zoom in on the result.",
  },
  {
    slug: "pbr-playground",
    title: "PBR Material Playground",
    description: "Adjust a physically-based material's color, roughness, metalness, clearcoat, and transmission in real time.",
  },
];
