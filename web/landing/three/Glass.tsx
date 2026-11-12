// "Private by design" (after ArgusVPN's Data Protection sphere): a glass sphere with soft colour behind it,
// a small light held inside, and a comet of light circling it, like your voice going round and staying inside.
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, MeshTransmissionMaterial, Trail } from "@react-three/drei";
import * as THREE from "three";

function Comet({ colour }: { colour: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.9;
    ref.current?.position.set(Math.cos(t) * 1.75, Math.sin(t * 2) * 0.35 + Math.sin(t) * 0.5, Math.sin(t) * 1.2);
  });
  return (
    <Trail width={1.4} length={7} color={new THREE.Color(colour)} attenuation={(w) => w * w}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshBasicMaterial color={new THREE.Color("#ffffff").multiplyScalar(4)} toneMapped={false} />
      </mesh>
    </Trail>
  );
}

/** Soft blobs of colour behind the glass, so it has something to bend and tint. */
function Backdrop({ colour, day }: { colour: string; day: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.15;
  });
  return (
    <group ref={ref} position={[0, 0, -2.4]}>
      <mesh position={[-0.9, 0.6, 0]}>
        <sphereGeometry args={[0.9, 32, 24]} />
        <meshBasicMaterial color={colour} />
      </mesh>
      <mesh position={[1, -0.5, 0]}>
        <sphereGeometry args={[0.75, 32, 24]} />
        <meshBasicMaterial color={day ? "#ffb48a" : "#6f7bff"} />
      </mesh>
      <mesh position={[0.2, 1.1, -0.4]}>
        <sphereGeometry args={[0.5, 32, 24]} />
        <meshBasicMaterial color={day ? "#c9cdfb" : "#a35cff"} />
      </mesh>
    </group>
  );
}

export default function Glass({ colour, day }: { colour: string; day: boolean }) {
  const bg = day ? "#f5f6fa" : "#06070c";
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 5.2], fov: 38 }} gl={{ antialias: true, alpha: true }}>
      <Backdrop colour={colour} day={day} />
      <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.6}>
        <mesh>
          <sphereGeometry args={[1.25, 96, 64]} />
          <MeshTransmissionMaterial
            background={new THREE.Color(bg)}
            samples={6}
            resolution={512}
            thickness={1.4}
            roughness={0.08}
            transmission={1}
            ior={1.4}
            chromaticAberration={0.3}
            anisotropy={0.2}
            distortion={0.3}
            distortionScale={0.4}
            temporalDistortion={0.08}
            iridescence={0.5}
            iridescenceIOR={1.2}
            color="#ffffff"
          />
        </mesh>
        {/* A small light held inside the glass: your voice, staying with you. */}
        <mesh>
          <sphereGeometry args={[0.24, 32, 24]} />
          <meshBasicMaterial color={new THREE.Color(colour).multiplyScalar(day ? 1 : 2.2)} toneMapped={false} />
        </mesh>
      </Float>
      <Comet colour={colour} />
      <Environment resolution={256}>
        <Lightformer intensity={3} position={[0, 4, -2]} scale={[8, 1, 1]} color="#ffffff" />
        <Lightformer intensity={2} position={[-4, 0, 2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} color={colour} />
        <Lightformer intensity={1.5} position={[4, -1, 2]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} color={day ? "#ffd2b8" : "#8f9bff"} />
      </Environment>
    </Canvas>
  );
}
