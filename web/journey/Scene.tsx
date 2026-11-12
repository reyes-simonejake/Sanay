// The 3D world of the journey: a night sky that turns to sunrise, a mirror floor, a skyline of homes and
// buildings gliding sideways under the hero, a lit street whose windows pulse like a voice, a ring of cards of real Filipinos and their calls, and the orb, Sanay's guide.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { PHOTOS, type Photo } from "../landing/photos";
import { pick, useLang, WALL, type WallTile } from "../landing/copy";
import { useTheme } from "../../src/lib/theme";
import { CHAPTERS, clamp, journey, smooth } from "./store";

/**
 * Sky colours per chapter, from the design tokens (DESIGN.md): night ink and cool paper grounds, Luminous
 * Indigo as the glow, and Ember, the warm rim of the light, only at sunrise.
 * Dark: the night before the call, to sunrise. Light: an early cool-paper morning that warms as the sun rises.
 */
type Sky = { top: string; horizon: string; floor: string };
const SKY: Record<"dark" | "light", Sky[]> = {
  dark: [
    { top: "#06070c", horizon: "#1b2063", floor: "#06070c" },
    { top: "#06070c", horizon: "#212778", floor: "#06070c" },
    { top: "#070816", horizon: "#283088", floor: "#06070c" },
    { top: "#090a1c", horizon: "#33358f", floor: "#07070e" },
    { top: "#10132e", horizon: "#9a5236", floor: "#0a0910" },
    { top: "#1d2654", horizon: "#ff8a4c", floor: "#120e14" },
  ],
  light: [
    { top: "#dfe3f3", horizon: "#f5f6fa", floor: "#eceef4" },
    { top: "#dde1f4", horizon: "#f3f4fb", floor: "#eceef4" },
    { top: "#d9ddf5", horizon: "#eef0fb", floor: "#ebedf4" },
    { top: "#d6daf4", horizon: "#f1eef6", floor: "#ebecf3" },
    { top: "#d9def5", horizon: "#fbe9de", floor: "#eeecf1" },
    { top: "#d7dff8", horizon: "#ffdcc4", floor: "#f1ece9" },
  ],
};

/** Where the camera stands and looks in each chapter. */
const CAM: { pos: [number, number, number]; look: [number, number, number] }[] = [
  { pos: [0, 1.5, 6], look: [0, 6.6, -8] },
  { pos: [0.4, 1.7, -9], look: [0, 1.5, -22] },
  { pos: [-0.3, 1.9, -23], look: [0.2, 1.4, -36] },
  { pos: [0.3, 1.5, -37], look: [0, 1.7, -50] },
  { pos: [0, 1.8, -56], look: [0, 1.8, -64] },
  { pos: [0, 2.2, -70], look: [0, 4.5, -160] },
];

const VOICES = {
  dark: { masculine: "#3f6bff", feminine: "#a35cff", natural: "#c4ccd8" },
  light: { masculine: "#2d55f0", feminine: "#8b3ff0", natural: "#7c8799" },
} as Record<"dark" | "light", Record<string, string>>;
const voiceColour = () => VOICES[journey.theme]![journey.voice] ?? "#6f7bff";

/** Interpolates any per-chapter list at the current scroll position. */
function at<T>(list: T[], f: number, mix: (a: T, b: T, t: number) => T): T {
  const i = clamp(Math.floor(f), 0, list.length - 1);
  const j = Math.min(list.length - 1, i + 1);
  return mix(list[i]!, list[j]!, smooth(clamp(f - i)));
}
const v3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export default function Scene() {
  const { theme } = useTheme();
  const day = theme === "light";
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 50, near: 0.1, far: 600, position: [0, 1.5, 6] }}
      className="!absolute inset-0"
    >
      <World day={day} />
      <EffectComposer multisampling={0}>
        {/* Bloom only catches true light (the orb, the bar tops, the sun); on paper it stays subtle. */}
        <Bloom mipmapBlur intensity={day ? 0.35 : 1.05} luminanceThreshold={day ? 0.92 : 0.88} luminanceSmoothing={0.25} />
        <Vignette offset={0.28} darkness={day ? 0.25 : 0.7} />
        <Noise opacity={day ? 0.018 : 0.028} premultiply />
      </EffectComposer>
    </Canvas>
  );
}

function World({ day }: { day: boolean }) {
  const f = useRef(0);
  const { camera, scene } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const fog = useMemo(() => new THREE.Fog("#232a72", 18, 120), []);
  scene.fog = fog;

  useFrame((_, dt) => {
    // Ease toward the scroll position, so the camera glides rather than jumps.
    f.current += (journey.at - f.current) * (1 - Math.exp(-dt * 4.5));
    const cam = at(CAM, f.current, (a, b, t) => ({ pos: v3(a.pos, b.pos, t), look: v3(a.look, b.look, t) }));
    camera.position.set(...cam.pos);
    look.set(...cam.look);
    camera.lookAt(look);
    const horizon = at(SKY[journey.theme], f.current, (a, b, t) => ({ ...a, horizon: new THREE.Color(a.horizon).lerp(new THREE.Color(b.horizon), t).getStyle() }));
    fog.color.set(horizon.horizon);
  });

  return (
    <>
      <Sky progress={f} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 8, 2]} intensity={0.6} />
      <StarField progress={f} />
      <Floor day={day} />
      <SoundCity day={day} />
      <SoundCity day={day} layout="skyline" />
      <Sun progress={f} day={day} />
      <Suspense fallback={null}>
        <PhotoRing progress={f} />
      </Suspense>
    </>
  );
}

/** A dome whose colours follow the chapter: deep night at the top, a glowing horizon. */
function Sky({ progress }: { progress: React.RefObject<number> }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, floorC: { value: new THREE.Color() } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 horizon; uniform vec3 floorC;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 c = mix(horizon, top, smoothstep(0.0, 0.55, h));
            c = mix(c, floorC, smoothstep(0.0, -0.08, h));
            // A soft band of light right on the horizon.
            c += horizon * 0.35 * exp(-abs(h) * 28.0);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  useFrame(() => {
    const p = progress.current ?? 0;
    const c = at(SKY[journey.theme], p, (a, b, t) => ({
      top: new THREE.Color(a.top).lerp(new THREE.Color(b.top), t).getStyle(),
      horizon: new THREE.Color(a.horizon).lerp(new THREE.Color(b.horizon), t).getStyle(),
      floor: new THREE.Color(a.floor).lerp(new THREE.Color(b.floor), t).getStyle(),
    }));
    mat.uniforms.top!.value.set(c.top);
    mat.uniforms.horizon!.value.set(c.horizon);
    mat.uniforms.floorC!.value.set(c.floor);
  });
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
}

function StarField({ progress }: { progress: React.RefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  useFrame(() => {
    const m = ref.current?.material as THREE.PointsMaterial | undefined;
    if (!m) return;
    m.transparent = true;
    m.opacity = journey.theme === "light" ? 0 : clamp(1 - ((progress.current ?? 0) - 3) / 1.6);
  });
  return <Stars ref={ref} radius={160} depth={60} count={4000} factor={5} saturation={0} fade speed={0.6} />;
}

/** A dark mirror floor that reflects the glow and the sound bars. */
function Floor({ day }: { day: boolean }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, -60]}>
      <planeGeometry args={[300, 300]} />
      <MeshReflectorMaterial
        resolution={512}
        mixBlur={1}
        mixStrength={18}
        blur={[400, 120]}
        mirror={day ? 0.35 : 0.6}
        roughness={0.9}
        metalness={0.5}
        depthScale={0.6}
        color={day ? "#e3e6ef" : "#07080f"}
      />
    </mesh>
  );
}

/**
 * Sound City: homes with pitched roofs along the street and buildings rising behind them, three rows deep,
 * taller toward the back: every lit window is someone who might be on a call. Its windows are
 * lit, a slow wave of light runs down the street like a voice, the roofs glow in the voice colour, and the
 * whole city brightens when you talk. It rises out of the floor once you leave the hero.
 */
type Lot = { x: number; z: number; w: number; d: number; h: number; seed: number; house: boolean };

/** Width of the hero skyline strip; it wraps around as it glides, so the street never ends. */
const SKYLINE_W = 96;

/** The hero: one long strip of homes in front and buildings behind, across the view, far enough to sit low. */
function skylineLots(r: () => number): Lot[] {
  const out: Lot[] = [];
  const row = (z: number, step: number, house: number, hMin: number, hMax: number) => {
    for (let x = -SKYLINE_W / 2; x < SKYLINE_W / 2; x += step * (0.85 + r() * 0.3)) {
      const isHouse = r() < house;
      out.push({
        x,
        z: z - r() * 1.5,
        w: isHouse ? 2 + r() * 0.6 : step * (0.7 + r() * 0.25),
        d: isHouse ? 2.2 + r() * 0.6 : 2 + r() * 1.5,
        h: isHouse ? 1.4 + (r() < 0.45 ? 1.1 : 0) + r() * 0.3 : hMin + r() * (hMax - hMin) + (r() < 0.1 ? 1.5 : 0),
        seed: r() * 100,
        house: isHouse,
      });
    }
  };
  row(-22, 2.8, 0.85, 3.2, 4.2);
  row(-28, 3.4, 0.35, 3.4, 5.6);
  row(-36, 3.8, 0, 4.2, 7.4);
  return out;
}

function SoundCity({ day, layout = "street" }: { day: boolean; layout?: "street" | "skyline" }) {
  const { scene } = useThree();
  const items = useMemo(() => {
    const out: Lot[] = [];
    let n = layout === "street" ? 1 : 7;
    const r = () => {
      n = (n * 16807) % 2147483647;
      return n / 2147483647;
    };
    if (layout === "skyline") return skylineLots(r);
    for (let k = 0; k < 46; k++) {
      for (const side of [-1, 1]) {
        for (let row = 0; row < 3; row++) {
          // Homes along the street in front, a few further back; buildings rise behind them.
          const house = r() < (row === 0 ? 0.7 : row === 1 ? 0.3 : 0.08);
          if (house) {
            // Two small homes side by side in the slot.
            for (let j = 0; j < 2; j++) {
              out.push({
                x: side * (8 + row * 6.5 + j * 2.6 + r() * 0.6),
                z: -10 - k * 3.4 - r() * 1.2,
                w: 2 + r() * 0.6,
                d: 2.2 + r() * 0.8,
                h: 1.4 + (r() < 0.45 ? 1.1 : 0) + r() * 0.3,
                seed: r() * 100,
                house: true,
              });
            }
            continue;
          }
          out.push({
            x: side * (8.5 + row * 6.5 + r() * 2.5),
            z: -10 - k * 3.4 - r() * 1.5,
            w: 1.6 + r() * 1.8,
            d: 1.6 + r() * 1.8,
            h: 3.2 + r() * 4.5 + row * 3.2 + (r() < 0.12 ? 6 : 0),
            seed: r() * 100,
            house: false,
          });
        }
      }
    }
    return out;
  }, []);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const roofs = useRef<THREE.InstancedMesh>(null);
  const homes = useMemo(() => items.filter((i) => i.house), [items]);
  // A pitched roof: a triangular prism, base at y 0, ridge at y 1, running along the depth.
  const roofGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v = [
      // front and back gables
      -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5,
      0.5, 0, -0.5, -0.5, 0, -0.5, 0, 1, -0.5,
      // left slope
      -0.5, 0, -0.5, -0.5, 0, 0.5, 0, 1, 0.5, -0.5, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5,
      // right slope
      0.5, 0, 0.5, 0.5, 0, -0.5, 0, 1, -0.5, 0.5, 0, 0.5, 0, 1, -0.5, 0, 1, 0.5,
    ];
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }), []);
  // Roof colours of Filipino homes at night: rust, deep teal, slate blue, old red.
  const ROOF = useMemo(() => ["#5a2e2a", "#1f4a4f", "#2b3a66", "#6b3326", "#3c3f4f"].map((c) => new THREE.Color(c)), []);
  useEffect(() => {
    homes.forEach((_, i) => roofs.current?.setColorAt(i, ROOF[i % ROOF.length]!));
    if (roofs.current?.instanceColor) roofs.current.instanceColor.needsUpdate = true;
  }, [homes, ROOF]);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(items.map((i) => i.seed)), 1));
    return g;
  }, [items]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          level: { value: 0 },
          roof: { value: new THREE.Color("#6f7bff") },
          body: { value: new THREE.Color("#0c0f1d") },
          warm: { value: new THREE.Color("#ffd9a8") },
          cool: { value: new THREE.Color("#c9d2ff") },
          fogColor: { value: new THREE.Color("#232a72") },
          fogNear: { value: 18 },
          fogFar: { value: 120 },
          paper: { value: 0 },
        },
        vertexShader: /* glsl */ `
          attribute float aSeed;
          varying vec3 vLocal; varying vec3 vScale; varying vec3 vN; varying float vSeed; varying float vDepth; varying vec3 vWorld;
          void main() {
            vLocal = position;
            vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
            vN = normal;
            vSeed = aSeed;
            vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
            vWorld = world.xyz;
            vec4 mv = viewMatrix * world;
            vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float time; uniform float level; uniform vec3 roof; uniform vec3 body; uniform vec3 warm; uniform vec3 cool;
          uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float paper;
          varying vec3 vLocal; varying vec3 vScale; varying vec3 vN; varying float vSeed; varying float vDepth; varying vec3 vWorld;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          void main() {
            float y = (vLocal.y + 0.5) * vScale.y;
            vec3 c = body * (0.75 + 0.5 * (vLocal.y + 0.5));
            if (vN.y > 0.5 && vScale.y > 2.9) {
              // The roof: a glowing plate in the voice colour.
              c = roof * (0.9 + level * 1.6);
            } else if (vN.y > -0.5) {
              float u = abs(vN.x) > 0.5 ? (vLocal.z + 0.5) * vScale.z : (vLocal.x + 0.5) * vScale.x;
              float house = step(vScale.y, 2.9);
              vec2 size = mix(vec2(0.42, 0.58), vec2(0.8, 1.05), house);
              vec2 cell = vec2(floor(u / size.x), floor(y / size.y));
              vec2 f = vec2(fract(u / size.x), fract(y / size.y));
              float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.28, f.y) * step(f.y, 0.78);
              // Keep a margin at the edges and the ground floor dark.
              float margin = step(0.3, u) * step(u, (abs(vN.x) > 0.5 ? vScale.z : vScale.x) - 0.3) * step(mix(0.7, 0.35, house), y) * step(y, vScale.y - mix(0.4, 0.2, house));
              float h = hash(cell + vSeed);
              float lit = step(0.52 - level * 0.25, h);
              // A slow wave of light travelling down the street, like a voice.
              float wave = 0.55 + 0.45 * sin((vWorld.z + vWorld.x) * 0.12 + time * 1.6 + vSeed);
              vec3 wc = mix(warm, cool, step(0.75, hash(cell.yx + vSeed)));
              c += wc * win * margin * lit * wave * (0.9 + level * 1.6);
              // A thin rim of light at the top edge of the taller buildings.
              c += roof * smoothstep(vScale.y - 0.12, vScale.y, y) * 0.9 * (1.0 - house);
            }
            float fog = smoothstep(fogNear, fogFar, vDepth);
            c = mix(c, fogColor, fog);
            c = mix(c, mix(c, vec3(0.86, 0.88, 0.93), 0.6), paper);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    // The street rises once you leave the hero; the hero skyline sinks away as you start to scroll.
    const rise =
      layout === "street"
        ? Math.max(0.001, smooth(clamp((journey.at - 0.35) / 0.6)))
        : Math.max(0.001, 1 - smooth(clamp((journey.at - 0.08) / 0.5)));
    // The hero skyline glides sideways, like the view from a moving jeepney, and wraps around.
    const slide = layout === "skyline" ? clock.elapsedTime * 1.1 : 0;
    const xAt = (x: number) => (layout === "skyline" ? ((((x + slide + SKYLINE_W / 2) % SKYLINE_W) + SKYLINE_W) % SKYLINE_W) - SKYLINE_W / 2 : x);
    items.forEach((b, i) => {
      const h = b.h * rise;
      m.compose(v.set(xAt(b.x), h / 2, b.z), q, sc.set(b.w, h, b.d));
      mesh.current?.setMatrixAt(i, m);
    });
    homes.forEach((b, i) => {
      const h = b.h * rise;
      m.compose(v.set(xAt(b.x), h, b.z), q, sc.set(b.w * 1.18, 0.9 * rise, b.d * 1.1));
      roofs.current?.setMatrixAt(i, m);
    });
    if (roofs.current) {
      roofs.current.instanceMatrix.needsUpdate = true;
      roofs.current.visible = rise > 0.02;
    }
    if (mesh.current) {
      mesh.current.instanceMatrix.needsUpdate = true;
      // Hidden until it starts to rise, so the hero shows no flat roofs on the horizon.
      mesh.current.visible = rise > 0.02;
    }
    const u = mat.uniforms;
    u.time!.value = clock.elapsedTime;
    u.level!.value += (journey.level - u.level!.value) * 0.15;
    // Roofs glow in the voice colour (Sanay indigo for your own voice).
    u.roof!.value.set(journey.voice === "natural" ? "#6f7bff" : voiceColour());
    u.paper!.value = day ? 1 : 0;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      u.fogColor!.value.copy(fog.color);
      u.fogNear!.value = fog.near;
      u.fogFar!.value = fog.far;
    }
  });
  return (
    <>
      <instancedMesh ref={mesh} args={[geo, mat, items.length]} frustumCulled={false} />
      <instancedMesh ref={roofs} args={[roofGeo, roofMat, homes.length]} frustumCulled={false} />
    </>
  );
}

/** The sun, rising in the last chapters. */
function Sun({ progress, day }: { progress: React.RefObject<number>; day: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const rise = smooth(clamp(((progress.current ?? 0) - 3.4) / 1.6));
    ref.current?.position.set(0, -14 + rise * 64, -220);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[11, 32, 16]} />
      <meshBasicMaterial color={new THREE.Color(day ? "#ffc9a1" : "#ffd9a8").multiplyScalar(day ? 1.05 : 2.4)} toneMapped={false} fog={false} />
    </mesh>
  );
}

const RING = WALL.filter((t): t is Extract<WallTile, { kind: "photo" }> => t.kind === "photo").slice(0, 14);
const CARD_W = 1.9;
const CARD_H = 2.5;

/** Draws one card: the photograph cover-fitted around its focus point, then who it is for and their call. */
function drawCard(img: HTMLImageElement | null, who: string, what: string, focus: string | undefined) {
  const W = 480;
  const H = Math.round((W * CARD_H) / CARD_W);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const r = 28;
  g.beginPath();
  g.roundRect(0, 0, W, H, r);
  g.fillStyle = "#0e1120";
  g.fill();
  g.save();
  g.clip();
  const pad = 14;
  const ph = H - 150;
  if (img) {
    const [fx, fy] = (focus ?? "50% 35%").split(" ").map((v) => parseFloat(v) / 100) as [number, number];
    const fw = W - pad * 2;
    const k = Math.max(fw / img.width, ph / img.height);
    const sw = fw / k;
    const sh = ph / k;
    const sx = Math.min(img.width - sw, Math.max(0, img.width * fx - sw / 2));
    const sy = Math.min(img.height - sh, Math.max(0, img.height * fy - sh / 2));
    g.save();
    g.beginPath();
    g.roundRect(pad, pad, fw, ph - pad, 18);
    g.clip();
    g.drawImage(img, sx, sy, sw, sh, pad, pad, fw, ph - pad);
    g.restore();
  }
  g.fillStyle = "rgba(201,206,255,0.75)";
  g.font = '500 26px "Mona Sans Variable", "Segoe UI", sans-serif';
  g.fillText(who, 26, ph + 46);
  g.fillStyle = "#ffffff";
  g.font = '650 34px "Mona Sans Variable", "Segoe UI", sans-serif';
  // Wrap the call onto two lines when it is long.
  const words = what.split(" ");
  let line = "";
  let y = ph + 92;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > W - 52 && line) {
      g.fillText(line, 26, y);
      line = w;
      y += 40;
    } else line = test;
  }
  g.fillText(line, 26, y);
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.12)";
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(1, 1, W - 2, H - 2, r);
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The people chapter: cards of real Filipinos with the call each one has coming, on a ring that turns slowly
 * around you, high in the frame so the title below stays clear. It fades in and out around its chapter,
 * before the camera ever reaches it.
 */
function PhotoRing({ progress }: { progress: React.RefObject<number> }) {
  const lang = useLang();
  const group = useRef<THREE.Group>(null);
  const [imgs, setImgs] = useState<(HTMLImageElement | null)[]>(() => RING.map(() => null));
  useEffect(() => {
    let alive = true;
    RING.forEach((t, i) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = PHOTOS[t.photo].src(640);
      img
        .decode()
        .then(() => alive && setImgs((prev) => prev.map((p, j) => (j === i ? img : p))))
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, []);
  const textures = useMemo(
    () => RING.map((t, i) => drawCard(imgs[i] ?? null, pick(t.who, lang), pick(t.what, lang), (PHOTOS[t.photo] as Photo).focus)),
    [imgs, lang],
  );
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  const mats = useMemo(() => textures.map((t) => new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.86, 0.86, 0.86), transparent: true, toneMapped: false, side: THREE.DoubleSide })), [textures]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const d = (progress.current ?? 0) - 4;
    // Fades in gently, and out quickly, well before the camera moves on toward the sunrise.
    const show = d < 0 ? smooth(clamp(1 + d / 0.55)) : smooth(clamp(1 - d / 0.28));
    g.visible = show > 0.01;
    g.rotation.y += dt * 0.07;
    g.scale.setScalar(0.92 + show * 0.08);
    for (const m of mats) m.opacity = show;
  });
  const R = 7;
  return (
    <group ref={group} position={[0, 3.05, -56]}>
      {mats.map((mat, i) => {
        const a = (i / mats.length) * Math.PI * 2;
        return (
          <mesh key={i} material={mat} position={[Math.sin(a) * R, 0, -Math.cos(a) * R]} rotation-y={-a}>
            <planeGeometry args={[CARD_W, CARD_H]} />
          </mesh>
        );
      })}
    </group>
  );
}

export { CHAPTERS };
