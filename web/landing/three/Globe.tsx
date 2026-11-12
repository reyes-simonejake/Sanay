// A dotted Earth (after ArgusVPN's dotted globe and Dala's particle shapes): land drawn as points of light,
// turning slowly, with arcs from Manila to cities where Filipinos work and study, and a label at each city.
// The land mask is three-globe's earth-water map (MIT, from NASA's public-domain imagery).
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { landPoints, toVec as toVecR } from "./land";

const R = 2;

export interface City {
  name: string;
  lat: number;
  lon: number;
}

const toVec = (lat: number, lon: number, r = R) => toVecR(lat, lon, r);

/** Land points from the shared map. */
function useLand() {
  const [points, setPoints] = useState<Float32Array | null>(null);
  useEffect(() => {
    let live = true;
    void landPoints(R).then((p) => live && setPoints(p));
    return () => {
      live = false;
    };
  }, []);
  return points;
}

function Earth({ cities, home, colour, day }: { cities: City[]; home: City; colour: string; day: boolean }) {
  const group = useRef<THREE.Group>(null);
  const land = useLand();
  const homeV = useMemo(() => toVec(home.lat, home.lon), [home]);
  const arcs = useMemo(
    () =>
      cities.map((c) => {
        const to = toVec(c.lat, c.lon);
        const mid = homeV.clone().add(to).multiplyScalar(0.5);
        mid.setLength(R + homeV.distanceTo(to) * 0.42);
        return new THREE.QuadraticBezierCurve3(homeV, mid, to).getPoints(64);
      }),
    [cities, homeV],
  );
  const arcMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { time: { value: 0 }, color: { value: new THREE.Color() } },
        vertexShader: /* glsl */ `
          attribute float t; varying float vT;
          void main() { vT = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float time; uniform vec3 color; varying float vT;
          void main() {
            float head = fract(time * 0.35);
            float a = smoothstep(head - 0.35, head, vT) * step(vT, head);
            gl_FragColor = vec4(color, 0.25 + a * 0.75);
          }`,
      }),
    [],
  );
  const arcGeos = useMemo(
    () =>
      arcs.map((pts) => {
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        g.setAttribute("t", new THREE.BufferAttribute(new Float32Array(pts.map((_, i) => i / (pts.length - 1))), 1));
        return g;
      }),
    [arcs],
  );
  // Start with the Philippines facing the visitor.
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const yaw = Math.atan2(homeV.x, homeV.z);
    g.rotation.y = -yaw - 0.25;
    g.rotation.x = 0.18;
  }, [homeV]);
  useFrame(({ clock }, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.05;
    arcMat.uniforms.time!.value = clock.elapsedTime;
    arcMat.uniforms.color!.value.set(colour);
  });
  return (
    <group ref={group}>
      {/* The sea: a dark (or pearl) ball just inside the land points. */}
      <mesh>
        <sphereGeometry args={[R * 0.985, 64, 48]} />
        <meshBasicMaterial color={day ? "#e8ebf6" : "#070915"} />
      </mesh>
      {land && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[land, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.022} color={day ? "#5b67e8" : "#8f9bff"} sizeAttenuation transparent opacity={0.9} />
        </points>
      )}
      {arcGeos.map((g, i) => (
        <line key={i}>
          <primitive object={g} attach="geometry" />
          <primitive object={arcMat} attach="material" />
        </line>
      ))}
      {[home, ...cities].map((c, i) => (
        <CityMark key={c.name} city={c} home={i === 0} colour={colour} />
      ))}
    </group>
  );
}

/** A city dot and its label; the label fades out when the city turns to the far side of the globe. */
function CityMark({ city, home, colour }: { city: City; home: boolean; colour: string }) {
  const ref = useRef<THREE.Group>(null);
  const label = useRef<HTMLSpanElement>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  const toCam = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const g = ref.current;
    const el = label.current;
    if (!g || !el) return;
    g.getWorldPosition(world);
    toCam.copy(camera.position).sub(world).normalize();
    const facing = world.clone().normalize().dot(toCam);
    el.style.opacity = String(Math.max(0, Math.min(1, (facing - 0.05) / 0.25)));
  });
  return (
    <group ref={ref} position={toVec(city.lat, city.lon, R * 1.01)}>
      <mesh>
        <sphereGeometry args={[home ? 0.045 : 0.03, 16, 12]} />
        <meshBasicMaterial color={home ? "#ffffff" : colour} toneMapped={false} />
      </mesh>
      <Html center distanceFactor={5} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <span ref={label} className={home ? "globe-label globe-home" : "globe-label"}>
          {city.name}
        </span>
      </Html>
    </group>
  );
}

export default function Globe({ cities, home, colour, day }: { cities: City[]; home: City; colour: string; day: boolean }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.4, 7.4], fov: 40 }} gl={{ antialias: true, alpha: true }}>
      <Earth cities={cities} home={home} colour={colour} day={day} />
      <OrbitControls enablePan={false} enableZoom={false} rotateSpeed={0.5} minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.7} />
    </Canvas>
  );
}
