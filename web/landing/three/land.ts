// Land as points on a sphere, from three-globe's earth-water map (MIT, from NASA's public-domain imagery).
// Shared by the hero planet and the "call anywhere" globe; the map is fetched once.
import * as THREE from "three";

const WATER_MAP = "https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-water.png";

export const toVec = (lat: number, lon: number, r: number) => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

let mask: Promise<{ data: Uint8ClampedArray; W: number; H: number } | null> | null = null;
function loadMask() {
  mask ??= new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = WATER_MAP;
    img.onload = () => {
      const W = 360;
      const H = 180;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return resolve(null);
      g.drawImage(img, 0, 0, W, H);
      try {
        resolve({ data: g.getImageData(0, 0, W, H).data, W, H });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
  });
  return mask;
}

/** Points on land, one every `step` degrees, thinned toward the poles, on a sphere of radius `r`. */
export async function landPoints(r: number, step = 1.4): Promise<Float32Array | null> {
  const m = await loadMask();
  if (!m) return null;
  const out: number[] = [];
  for (let lat = -84; lat <= 84; lat += step) {
    const ring = Math.max(1, Math.round((360 / step) * Math.cos((lat * Math.PI) / 180)));
    for (let k = 0; k < ring; k++) {
      const lon = -180 + (k / ring) * 360;
      const x = Math.floor(((lon + 180) / 360) * (m.W - 1));
      const y = Math.floor(((90 - lat) / 180) * (m.H - 1));
      if (m.data[(y * m.W + x) * 4]! < 128) {
        const v = toVec(lat, lon, r);
        out.push(v.x, v.y, v.z);
      }
    }
  }
  return new Float32Array(out);
}
