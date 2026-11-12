// The closing 3D logo (after Sellix's spinning logo with particles): Sanay's "Voice Line" mark, an indigo orb
// with a white voice wave passing through it, turning slowly, with points of light orbiting it.
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

/** The wave from public/logo.svg, in orb units (radius 1). */
function waveCurve() {
  const v = (x: number, y: number) => new THREE.Vector3((x - 256) / 156, -(y - 256) / 156, 0);
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.CubicBezierCurve3(v(86, 256), v(146, 256), v(166, 176), v(216, 176)));
  path.add(new THREE.CubicBezierCurve3(v(216, 176), v(266, 176), v(286, 336), v(336, 336)));
  path.add(new THREE.CubicBezierCurve3(v(336, 336), v(386, 336), v(386, 256), v(426, 256)));
  return path;
}

function Mark({ colour }: { colour: string }) {
  const group = useRef<THREE.Group>(null);
  const tube = useRef<THREE.Mesh>(null);
  const orbMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { mid: { value: new THREE.Color("#5b5fe8") } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vView; varying vec3 vP;
          void main() {
            vP = position;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 mid; varying vec3 vN; varying vec3 vView; varying vec3 vP;
          void main() {
            // The logo's gradient: light low in the orb, deep indigo at the edge, plus a bright rim.
            float d = length(vec2(vP.x, vP.y + 0.45)) / 1.4;
            vec3 c = mix(vec3(0.725, 0.77, 1.0), mid, smoothstep(0.0, 0.55, d));
            c = mix(c, vec3(0.086, 0.07, 0.31), smoothstep(0.55, 1.0, d));
            float f = pow(1.0 - max(dot(vN, vView), 0.0), 3.0);
            gl_FragColor = vec4(c + mid * f * 1.6, 1.0);
          }`,
      }),
    [],
  );
  const tubeGeo = useMemo(() => new THREE.TubeGeometry(waveCurve(), 220, 0.095, 16, false), []);
  const ring = useMemo(() => {
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.02;
      const r = 1.65 + (Math.random() - 0.5) * 0.25;
      pos.set([Math.cos(a) * r, (Math.random() - 0.5) * 0.08, Math.sin(a) * r], i * 3);
    }
    return pos;
  }, []);
  const ringRef = useRef<THREE.Points>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    start.current ??= t;
    if (group.current) group.current.rotation.y = Math.sin(t * 0.4) * 0.35;
    if (ringRef.current) ringRef.current.rotation.y = t * 0.35;
    // The wave draws itself in once, left to right.
    const p = Math.min(1, (t - start.current) / 1.6);
    tubeGeo.setDrawRange(0, Math.floor(tubeGeo.index!.count * (1 - (1 - p) ** 3)));
  });
  return (
    <group ref={group}>
      <mesh material={orbMat}>
        <sphereGeometry args={[1, 96, 64]} />
      </mesh>
      <mesh ref={tube} geometry={tubeGeo} position-z={0.95}>
        <meshBasicMaterial color={new THREE.Color("#ffffff").multiplyScalar(1.6)} toneMapped={false} />
      </mesh>
      <points ref={ringRef} rotation-x={0.35}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ring, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.035} color={new THREE.Color(colour).multiplyScalar(1.8)} toneMapped={false} transparent opacity={0.9} />
      </points>
    </group>
  );
}

export default function LogoMark({ colour }: { colour: string }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 5.4], fov: 40 }} gl={{ antialias: true, alpha: true }}>
      <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.5}>
        <Mark colour={colour} />
      </Float>
    </Canvas>
  );
}
