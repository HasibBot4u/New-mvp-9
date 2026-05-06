import { Component, ErrorInfo, ReactNode, Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import * as THREE from "three";

class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("WebGL Canvas Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

function Crystal({
  position,
  color,
  speed,
  distort,
  scale = 1,
}: { position: [number, number, number]; color: string; speed: number; distort: number; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * 0.15 * speed;
    ref.current.rotation.y = t * 0.2 * speed;
    const mx = state.mouse.x * 0.4;
    const my = state.mouse.y * 0.4;
    ref.current.position.x = position[0] + mx * 0.3;
    ref.current.position.y = position[1] + my * 0.3;
  });
  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.8}>
      <mesh ref={ref} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color={color}
          roughness={0.25}
          metalness={0.4}
          distort={distort}
          speed={1.5}
        />
      </mesh>
    </Float>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={["#0A0A0A"]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[5, 5, 5]} intensity={2.2} color="#FF2E55" />
      <pointLight position={[-5, -3, -5]} intensity={1.5} color="#FFB23A" />
      <pointLight position={[0, 0, 6]} intensity={0.9} color="#ffffff" />

      <Crystal position={[-2.4, 0.5, 0]} color="#FF2E55" speed={0.8} distort={0.42} scale={1.05} />
      <Crystal position={[2.4, -0.4, -0.5]} color="#FFB23A" speed={1.0} distort={0.38} scale={1.0} />
      <Crystal position={[0, 0.2, -1.2]} color="#7C3AED" speed={0.6} distort={0.5} scale={1.25} />

      <Sparkles count={80} scale={[10, 6, 6]} size={2} speed={0.4} color="#ffffff" opacity={0.6} />
    </>
  );
}

export function HeroCanvas() {
  return (
    <div className="absolute inset-0 bg-[#0A0A0A]">
      <CanvasErrorBoundary fallback={<div className="absolute inset-0 bg-[#0A0A0A] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#0A0A0A] to-[#0A0A0A]" />}>
        <Canvas
          camera={{ position: [0, 0, 5.5], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, alpha: false, powerPreference: "default", preserveDrawingBuffer: false }}
          className="!absolute inset-0"
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
