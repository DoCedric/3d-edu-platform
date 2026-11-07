# Demo Links

Live site: **https://3d-edu-platform.vercel.app/**

The home page is a gallery of every demo. Each demo is also a standalone page under `/embed/<slug>`, meant to be shown in an iframe.

| # | Demo | Link | What it shows |
|---|------|------|---------------|
| 1 | Point Coordinates | https://3d-edu-platform.vercel.app/embed/coordinate-point | Drag a point along the X/Y/Z axes and watch its coordinates update live. |
| 2 | Spatial Coordinates | https://3d-edu-platform.vercel.app/embed/cube-coordinates | Move a cube through world space while its own local coordinates stay fixed (object vs. world space). |
| 3 | Triangle Anatomy | https://3d-edu-platform.vercel.app/embed/triangle-anatomy | Toggle a triangle's vertices, edges, and faces independently to see how a mesh is built up. |
| 4 | Lambert Diffuse Lighting | https://3d-edu-platform.vercel.app/embed/lambert-diffuse | Drag a light around a triangle to see its normal, light vector, angle, and the resulting diffuse shading. |
| 5 | Lambert Diffuse (Icosphere) | https://3d-edu-platform.vercel.app/embed/lambert-diffuse-icosphere | The same Lambert diffuse lesson, computed per face across a full icosphere. |
| 6 | Barycentric Coordinates & UV Sampling | https://3d-edu-platform.vercel.app/embed/barycentric-coordinates | Hover a 3D triangle and its UV layout together to see how barycentric weights sample a texture. |
| 7 | Shading Techniques | https://3d-edu-platform.vercel.app/embed/shading-techniques | Compare flat, Gouraud, and Phong shading on the same low-poly sphere under a draggable light. |
| 8 | Bit Depth & Dithering | https://3d-edu-platform.vercel.app/embed/bit-depth | Reduce an image's bit depth and channel, with optional dithering, then zoom in on the result. |
| 9 | PBR Material Playground | https://3d-edu-platform.vercel.app/embed/pbr-playground | Adjust a physically-based material's color, roughness, metalness, clearcoat, and transmission in real time. |
| 10 | Path Tracing Playground | https://3d-edu-platform.vercel.app/embed/path-tracing | Watch rays leave a camera, bounce randomly around a 2D room, and average into a clean image (noise, bounces, shadows, and fireflies). Drag the ball and the lamp to move the shadow. |

## Embedding

This is the same snippet the gallery's "Embed" button copies. Replace `<slug>` with a slug from the table above:

```html
<iframe src="https://3d-edu-platform.vercel.app/embed/<slug>" width="800" height="600" style="border: none;" loading="lazy" allowfullscreen></iframe>
```

## Keeping this file current

The list of demos comes from [src/lib/demos.ts](src/lib/demos.ts). When you add a demo there, add a row here too.
