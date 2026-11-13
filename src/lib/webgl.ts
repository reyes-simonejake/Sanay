// Phones allow only a few live WebGL contexts per page (Chrome on Android drops the oldest one past
// its limit, and that canvas turns into a white box). So: test for WebGL once, hand the test
// context straight back, and let every 3D piece hold a context only while it is near the screen.

let cached: boolean | null = null;

/** True when this browser can draw WebGL. Tested once; the test context is released right away. */
export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    cached = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}
