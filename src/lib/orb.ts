// The Sanay orb: one fragment shader on a square canvas, no libraries.
// On = a liquid orb (white-hot underside, coloured body, a rim crescent and a soft glow)
// whose edge moves with the live voice level. Off = it collapses to a thin dim ring.
// The colour is the voice: each voice has its own light, and changes cross-fade.

export type OrbVoice = "masculine" | "feminine" | "natural";
type RGB = [number, number, number];
interface Palette {
  deep: RGB;
  mid: RGB;
  high: RGB;
  rim: RGB;
  glow: RGB;
}

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;

export const ORB_PALETTES: Record<OrbVoice, Palette> = {
  masculine: { deep: hex("#08156e"), mid: hex("#3f6bff"), high: hex("#dfe8ff"), rim: hex("#8fb0ff"), glow: hex("#3a63ff") },
  feminine: { deep: hex("#2c0b6b"), mid: hex("#a35cff"), high: hex("#ffe3f2"), rim: hex("#ff7ab6"), glow: hex("#a957ff") },
  natural: { deep: hex("#222b3b"), mid: hex("#8a97ab"), high: hex("#ffffff"), rim: hex("#7fd8ff"), glow: hex("#9fbbe0") },
};

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uLevel, uOn, uLight, uSilk;
uniform vec3 uDeep, uMid, uHigh, uRim, uGlow;

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y));
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = uTime;

  // Living edge: three slow waves, stronger while you speak.
  float amp = (0.20 + 0.75 * uLevel) * uOn;
  float wob = 0.030 * sin(3.0 * a + t * 1.05)
            + 0.022 * sin(5.0 * a - t * 1.60 + 1.3)
            + 0.016 * sin(2.0 * a + t * 0.70 + 2.1);
  float R = mix(0.47, 0.42, uOn) + wob * amp;
  float d = r - R;                        // signed distance to the edge
  vec2 q = p / R;                         // orb space, edge at length 1

  // Body: deep at the top, white-hot underside, brighter towards the edge (volume), slow inner flow.
  float inside = smoothstep(0.005, -0.005, d);
  float flow = 0.12 * sin(q.x * 2.6 + t * 0.8) * sin(q.y * 2.2 - t * 0.6);
  float hot = exp(-length(q - vec2(0.0, -0.62)) * 2.3);
  float top = smoothstep(-0.3, 0.95, q.y);
  vec3 body = mix(uMid, uDeep, top * 0.9);
  body = mix(body, uHigh, clamp(hot * 1.15 + flow * hot, 0.0, 1.0));
  body += uMid * smoothstep(-0.22, 0.0, d) * 0.35;
  body = mix(body, uHigh, 0.22 * uLight);  // on paper: lighter body, never a murky ball

  // Rim: a thin bright line, strongest on the upper-left (where the light catches).
  float side = smoothstep(-0.3, 0.9, dot(normalize(p + 1e-5), normalize(vec2(-0.6, 0.8))));
  float rimLine = exp(-abs(d) * 120.0) * (0.25 + 0.75 * side);

  // Glow outside the edge, brighter with the voice.
  float glow = exp(-max(d, 0.0) * 6.5) * (1.0 - inside) * (0.5 + 0.8 * uLevel);
  glow *= smoothstep(1.0, 0.72, r);      // fade out before the canvas edge: no visible box
  glow *= mix(0.6, 1.0, 1.0 - uLight);

  // Off: a thin ring of light at the edge.
  float ring = (exp(-abs(d) * 80.0) * 0.8 + exp(-abs(d) * 14.0) * 0.16) * smoothstep(1.0, 0.8, r);
  vec3 ringCol = mix(vec3(0.6, 0.64, 0.74), uRim, 0.3);

  float bodyA = inside * uOn;
  float rimA = rimLine * uOn;
  float glowA = glow * uOn;
  float ringA = ring * (1.0 - uOn);
  // Silk: thin waves of light flowing behind the orb (the voice references), louder with the voice.
  float aspect = uRes.x / min(uRes.x, uRes.y);
  float silk = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float k = 1.5 + fi * 0.42;
    float ph = t * (0.32 + fi * 0.11) + fi * 1.9;
    float amp = 0.07 + 0.035 * fi + 0.30 * uLevel;
    float y = amp * sin(p.x * k + ph) * (0.65 + 0.35 * sin(p.x * 0.8 - t * 0.27 + fi));
    float dy = abs(p.y - y);
    float line = exp(-dy / (0.0035 + 0.0015 * fi)) * 0.6 + exp(-dy * 24.0) * 0.08;
    silk += line * (0.6 - fi * 0.1);
  }
  silk *= smoothstep(min(aspect, 1.0), 0.3, abs(p.x)) * uSilk * uOn * (1.0 - inside);
  vec3 silkCol = mix(mix(uGlow, uHigh, 0.45), uGlow * 0.85, uLight);  // deeper on paper, so it reads

  vec3 col = body * bodyA + uRim * rimA + uGlow * glowA + ringCol * ringA + silkCol * silk;
  float alpha = clamp(bodyA + rimA + glowA * 0.8 + ringA + silk * 0.9, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);       // premultiplied
}`;

export interface OrbState {
  on: boolean;
  voice: OrbVoice;
  /** 0..1, the current voice level. */
  level: number;
}

export class OrbRenderer {
  private gl: WebGLRenderingContext;

  private u: Record<string, WebGLUniformLocation | null> = {};
  private raf = 0;
  private start = performance.now();
  private on = 0;
  private level = 0;
  private pal: Palette;
  target: OrbState = { on: false, voice: "natural", level: 0 };
  light = false;
  reducedMotion = false;
  /** Draw the silk lines (large surfaces only). */
  silk = false;

  static create(canvas: HTMLCanvasElement): OrbRenderer | null {
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    return gl ? new OrbRenderer(canvas, gl) : null;
  }

  private constructor(
    private canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
  ) {
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ["uRes", "uTime", "uLevel", "uOn", "uLight", "uSilk", "uDeep", "uMid", "uHigh", "uRim", "uGlow"]) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.pal = clonePalette(ORB_PALETTES.natural);
  }

  run() {
    const frame = () => {
      this.draw();
      this.raf = requestAnimationFrame(frame);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  /** Stops drawing. The context stays with the canvas (React may mount the same canvas again). */
  destroy() {
    this.stop();
  }

  private draw() {
    const { gl, canvas } = this;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);

    // Ease toward the target: switching on blooms (slow), level follows speech (fast up, slower down).
    this.on += ((this.target.on ? 1 : 0) - this.on) * (this.target.on ? 0.06 : 0.09);
    const lv = this.target.level;
    this.level += (lv - this.level) * (lv > this.level ? 0.35 : 0.08);
    const goal = ORB_PALETTES[this.target.voice];
    for (const k of Object.keys(goal) as (keyof Palette)[]) {
      for (let i = 0; i < 3; i++) this.pal[k][i] += (goal[k][i] - this.pal[k][i]) * 0.06;
    }

    const t = ((performance.now() - this.start) / 1000) * (this.reducedMotion ? 0.15 : 1);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.u.uRes, w, h);
    gl.uniform1f(this.u.uTime, t);
    gl.uniform1f(this.u.uLevel, this.reducedMotion ? this.level * 0.3 : this.level);
    gl.uniform1f(this.u.uOn, this.on);
    gl.uniform1f(this.u.uLight, this.light ? 1 : 0);
    gl.uniform1f(this.u.uSilk, this.silk ? 1 : 0);
    gl.uniform3fv(this.u.uDeep, this.pal.deep);
    gl.uniform3fv(this.u.uMid, this.pal.mid);
    gl.uniform3fv(this.u.uHigh, this.pal.high);
    gl.uniform3fv(this.u.uRim, this.pal.rim);
    gl.uniform3fv(this.u.uGlow, this.pal.glow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

function clonePalette(p: Palette): Palette {
  return { deep: [...p.deep], mid: [...p.mid], high: [...p.high], rim: [...p.rim], glow: [...p.glow] };
}

/** dBFS (about -60..-12 for speech) to 0..1. */
export const levelFromDb = (db: number) => Math.max(0, Math.min(1, (db + 58) / 42));
