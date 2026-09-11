"use client";

import { useMemo } from "react";
import * as THREE from "three";

interface Label3DProps {
  text: string;
  color?: string;
  position?: [number, number, number];
  size?: number;
}

const FONT_PX = 48;
const PADDING_PX = 16;

/** Camera-facing text label for any scene, rendered via the browser's own
 * canvas text rendering - no external font fetch, no extra dependency. */
export function Label3D({ text, color = "#ffffff", position = [0, 0, 0], size = 0.5 }: Label3DProps) {
  const sprite = useMemo(() => {
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    let textWidth = FONT_PX * text.length * 0.6;
    if (measureCtx) {
      measureCtx.font = `bold ${FONT_PX}px sans-serif`;
      textWidth = measureCtx.measureText(text).width;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(textWidth) + PADDING_PX * 2;
    canvas.height = FONT_PX + PADDING_PX * 2;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = `bold ${FONT_PX}px sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const spriteObj = new THREE.Sprite(material);
    const aspect = canvas.width / canvas.height;
    spriteObj.scale.set(size * aspect, size, 1);
    return spriteObj;
  }, [text, color, size]);

  return <primitive object={sprite} position={position} />;
}
