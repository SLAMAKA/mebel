import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Group } from 'three'
import { handlePlan, hingeHeights, type Compiled, type Part, type Span } from './geometry'
import {
  boards,
  colors,
  findById,
  finishes,
  type BoardId,
  type ColorId,
  type SceneLook,
} from './model'

type Mat = {
  color: string
  roughness: number
  metalness: number
  map?: CanvasTexture
}

const grainCache = new Map<string, CanvasTexture>()

function grain(hex: string, strong: boolean) {
  const key = `${hex}-${strong ? 's' : 'w'}`
  const cached = grainCache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.fillStyle = hex
  ctx.fillRect(0, 0, 512, 512)
  const lines = strong ? 32 : 14
  for (let i = 0; i < lines; i++) {
    const y = (i * 512) / lines
    ctx.strokeStyle = `rgba(50, 28, 12, ${strong ? 0.04 : 0.02})`
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(150, y + 7, 320, y - 6, 512, y + 3)
    ctx.stroke()
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(1, 1)
  grainCache.set(key, tex)
  return tex
}

function woody(board: BoardId, color: ColorId) {
  return board === 'veneer' || color === 'oak' || color === 'walnut' || color === 'sand'
}

function shade(hex: string, amount: number) {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => {
    const value = Math.max(0, Math.min(255, ((n >> shift) & 255) + amount))
    return value.toString(16).padStart(2, '0')
  }
  return `#${channel(16)}${channel(8)}${channel(0)}`
}

function styleFor(part: Part, config: SceneLook): Mat {
  const carcassBoard = findById(boards, config.carcassBoard)
  const facadeBoard = findById(boards, config.facadeBoard)
  const carcassHex = findById(colors, config.carcassColor).hex
  const facadeHex = findById(colors, config.facadeColor).hex
  const finish = findById(finishes, config.finish)

  if (part.role === 'metal') {
    return { color: finish.color, roughness: finish.roughness, metalness: finish.metalness }
  }

  const painted = part.role === 'facade'
  const board = painted ? facadeBoard : carcassBoard
  const colorId = painted ? config.facadeColor : config.carcassColor
  const hex = painted ? facadeHex : carcassHex
  const shaded = part.role === 'back' || part.role === 'plinth' ? shade(hex, part.role === 'plinth' ? -32 : -16) : hex
  const map = woody(board.id, colorId) && part.role !== 'plinth' ? grain(shaded, board.id === 'veneer') : undefined
  return {
    color: shaded,
    roughness: board.roughness,
    metalness: board.id === 'mdf' ? 0.05 : 0.02,
    map,
  }
}

function Material({ mat, hot }: { mat: Mat; hot?: boolean }) {
  return (
    <meshStandardMaterial
      color={mat.map ? '#ffffff' : mat.color}
      map={mat.map}
      roughness={mat.roughness}
      metalness={mat.metalness}
      emissive={hot ? '#ffffff' : '#000000'}
      emissiveIntensity={hot ? 0.14 : 0}
    />
  )
}

function FinishMaterial({ config }: { config: SceneLook }) {
  const finish = findById(finishes, config.finish)
  return <meshStandardMaterial color={finish.color} roughness={finish.roughness} metalness={finish.metalness} />
}

function HandleMesh({ handle, config }: { handle: SceneLook['handle']; config: SceneLook }) {
  if (handle === 'none') return null
  if (handle === 'knob') {
    return (
      <mesh position={[0, 0, 0.016]} castShadow>
        <sphereGeometry args={[0.012, 16, 12]} />
        <FinishMaterial config={config} />
      </mesh>
    )
  }
  if (handle === 'edge') {
    return (
      <mesh position={[0, 0, 0.012]} castShadow>
        <boxGeometry args={[0.016, 0.34, 0.028]} />
        <FinishMaterial config={config} />
      </mesh>
    )
  }
  if (handle === 'bow') {
    return (
      <group>
        <mesh position={[0, -0.05, 0.008]} castShadow>
          <boxGeometry args={[0.012, 0.012, 0.018]} />
          <FinishMaterial config={config} />
        </mesh>
        <mesh position={[0, 0.05, 0.008]} castShadow>
          <boxGeometry args={[0.012, 0.012, 0.018]} />
          <FinishMaterial config={config} />
        </mesh>
        <mesh position={[0, 0, 0.02]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.055, 0.006, 8, 16, Math.PI]} />
          <FinishMaterial config={config} />
        </mesh>
      </group>
    )
  }
  if (handle === 'rail') {
    const bar = 0.28
    return (
      <group>
        <mesh position={[-bar / 2, 0, 0.006]} castShadow>
          <boxGeometry args={[0.012, 0.012, 0.02]} />
          <FinishMaterial config={config} />
        </mesh>
        <mesh position={[bar / 2, 0, 0.006]} castShadow>
          <boxGeometry args={[0.012, 0.012, 0.02]} />
          <FinishMaterial config={config} />
        </mesh>
        <mesh position={[0, 0, 0.012]} castShadow>
          <boxGeometry args={[bar, 0.01, 0.01]} />
          <FinishMaterial config={config} />
        </mesh>
      </group>
    )
  }
  // Скоба вертикально.
  const bar = 0.12
  return (
    <group>
      <mesh position={[0, -bar / 2 + 0.012, 0.006]} castShadow>
        <boxGeometry args={[0.012, 0.012, 0.02]} />
        <FinishMaterial config={config} />
      </mesh>
      <mesh position={[0, bar / 2 - 0.012, 0.006]} castShadow>
        <boxGeometry args={[0.012, 0.012, 0.02]} />
        <FinishMaterial config={config} />
      </mesh>
      <mesh position={[0, 0, 0.012]} castShadow>
        <boxGeometry args={[0.01, bar, 0.01]} />
        <FinishMaterial config={config} />
      </mesh>
    </group>
  )
}

function FrameOverlay({
  size,
  meshX,
  frame,
  baseColor,
  map,
}: {
  size: [number, number, number]
  meshX: number
  frame: SceneLook['frame']
  baseColor: string
  map?: CanvasTexture
}) {
  if (frame === 'plain') return null

  const w = size[0]
  const h = size[1]
  const z0 = size[2] / 2 + 0.0008
  const dark = shade(baseColor, -28)
  const mid = shade(baseColor, -14)
  const light = shade(baseColor, 10)

  function FaceMat({ color, rough = 0.58 }: { color: string; rough?: number }) {
    return (
      <meshStandardMaterial
        color={map ? '#ffffff' : color}
        map={map}
        roughness={rough}
        metalness={0.02}
      />
    )
  }

  // Прямоугольная «обводка» на лице фасада.
  function Band({
    inset,
    width: bandW,
    depth,
    color,
    z,
  }: {
    inset: number
    width: number
    depth: number
    color: string
    z: number
  }) {
    const iw = Math.max(0.01, w - inset * 2)
    const ih = Math.max(0.01, h - inset * 2)
    const sideH = Math.max(0.008, ih - bandW * 2)
    return (
      <group position={[0, 0, z]}>
        <mesh position={[0, ih / 2 - bandW / 2, 0]} castShadow>
          <boxGeometry args={[iw, bandW, depth]} />
          <FaceMat color={color} />
        </mesh>
        <mesh position={[0, -ih / 2 + bandW / 2, 0]} castShadow>
          <boxGeometry args={[iw, bandW, depth]} />
          <FaceMat color={color} />
        </mesh>
        <mesh position={[-iw / 2 + bandW / 2, 0, 0]} castShadow>
          <boxGeometry args={[bandW, sideH, depth]} />
          <FaceMat color={color} />
        </mesh>
        <mesh position={[iw / 2 - bandW / 2, 0, 0]} castShadow>
          <boxGeometry args={[bandW, sideH, depth]} />
          <FaceMat color={color} />
        </mesh>
      </group>
    )
  }

  function Panel({ inset, depth, color, z }: { inset: number; depth: number; color: string; z: number }) {
    const pw = Math.max(0.01, w - inset * 2)
    const ph = Math.max(0.01, h - inset * 2)
    return (
      <mesh position={[0, 0, z]} castShadow>
        <boxGeometry args={[pw, ph, depth]} />
        <FaceMat color={color} rough={0.66} />
      </mesh>
    )
  }

  // Узкая: тонкая канавка у края.
  if (frame === 'thin') {
    return (
      <group position={[meshX, 0, z0]}>
        <Band inset={0.018} width={0.01} depth={0.002} color={dark} z={0.001} />
        <Band inset={0.03} width={0.014} depth={0.0035} color={mid} z={0.002} />
      </group>
    )
  }

  // Широкая: широкий борт и глубокая филёнка.
  if (frame === 'wide') {
    return (
      <group position={[meshX, 0, z0]}>
        <Band inset={0.012} width={0.055} depth={0.005} color={mid} z={0.0015} />
        <Band inset={0.068} width={0.012} depth={0.0025} color={dark} z={0.003} />
        <Panel inset={0.086} depth={0.004} color={light} z={0.001} />
        <Band inset={0.092} width={0.008} depth={0.002} color={dark} z={0.004} />
      </group>
    )
  }

  // Двойная: две параллельные обводки.
  if (frame === 'double') {
    return (
      <group position={[meshX, 0, z0]}>
        <Band inset={0.014} width={0.022} depth={0.0035} color={mid} z={0.0015} />
        <Band inset={0.048} width={0.01} depth={0.002} color={dark} z={0.0028} />
        <Band inset={0.07} width={0.02} depth={0.0035} color={mid} z={0.0015} />
        <Panel inset={0.1} depth={0.003} color={light} z={0.001} />
      </group>
    )
  }

  // Фаска: скос к центру ступеньками.
  if (frame === 'bevel') {
    return (
      <group position={[meshX, 0, z0]}>
        <Band inset={0.01} width={0.02} depth={0.002} color={dark} z={0.001} />
        <Band inset={0.032} width={0.024} depth={0.003} color={mid} z={0.002} />
        <Band inset={0.058} width={0.02} depth={0.004} color={light} z={0.003} />
        <Panel inset={0.082} depth={0.0025} color={shade(baseColor, 16)} z={0.0015} />
      </group>
    )
  }

  // Классика: рамка + паз + филёнка.
  return (
    <group position={[meshX, 0, z0]}>
      <Band inset={0.014} width={0.038} depth={0.0045} color={mid} z={0.0015} />
      <Band inset={0.052} width={0.008} depth={0.002} color={dark} z={0.003} />
      <Panel inset={0.066} depth={0.0035} color={light} z={0.0012} />
      <Band inset={0.072} width={0.006} depth={0.0018} color={dark} z={0.0038} />
    </group>
  )
}

function MirrorOverlay({
  size,
  meshX,
  mirror,
}: {
  size: [number, number, number]
  meshX: number
  mirror: SceneLook['mirror']
}) {
  if (!mirror || mirror === 'none') return null
  const z = size[2] / 2 + 0.006
  const glass = <meshStandardMaterial color="#c8d4e0" roughness={0.08} metalness={0.85} envMapIntensity={1.2} />

  if (mirror === 'full') {
    const pad = 0.028
    return (
      <mesh position={[meshX, 0, z]} castShadow>
        <boxGeometry args={[Math.max(0.04, size[0] - pad * 2), Math.max(0.04, size[1] - pad * 2), 0.004]} />
        {glass}
      </mesh>
    )
  }

  if (mirror === 'panel') {
    const padX = size[0] * 0.14
    const padY = size[1] * 0.12
    return (
      <mesh position={[meshX, 0, z]} castShadow>
        <boxGeometry args={[Math.max(0.04, size[0] - padX * 2), Math.max(0.04, size[1] - padY * 2), 0.004]} />
        {glass}
      </mesh>
    )
  }

  if (mirror === 'oval') {
    const rw = Math.max(0.05, size[0] * 0.32)
    const rh = Math.max(0.08, size[1] * 0.28)
    return (
      <mesh position={[meshX, size[1] * 0.12, z]} scale={[1, rh / rw, 1]} castShadow>
        <circleGeometry args={[rw, 32]} />
        {glass}
      </mesh>
    )
  }

  // Полоса по центру.
  return (
    <mesh position={[meshX, 0, z]} castShadow>
      <boxGeometry args={[Math.max(0.04, size[0] * 0.42), Math.max(0.08, size[1] - 0.16), 0.004]} />
      {glass}
    </mesh>
  )
}

function ShoeTray({
  part,
  config,
  meshX,
}: {
  part: Part
  config: SceneLook
  meshX: number
}) {
  const board = styleFor({ ...part, role: 'carcass' }, config)
  const w = part.size[0]
  const h = part.size[1]
  const thick = 0.016
  const trayD = Math.min(0.2, Math.max(0.12, h * 0.5))
  const z = -part.size[2] / 2 - trayD / 2
  const sideH = h * 0.58

  return (
    <group position={[meshX, 0, 0]}>
      <mesh position={[0, -h / 2 + thick / 2, z]} castShadow>
        <boxGeometry args={[Math.max(0.08, w - 0.02), thick, trayD]} />
        <Material mat={board} />
      </mesh>
      <mesh position={[-(w / 2 - thick / 2), -h / 2 + sideH / 2, z]} castShadow>
        <boxGeometry args={[thick, sideH, trayD]} />
        <Material mat={board} />
      </mesh>
      <mesh position={[w / 2 - thick / 2, -h / 2 + sideH / 2, z]} castShadow>
        <boxGeometry args={[thick, sideH, trayD]} />
        <Material mat={board} />
      </mesh>
      <mesh position={[0, -h / 2 + sideH * 0.42, z]} castShadow>
        <boxGeometry args={[thick, sideH * 0.72, trayD * 0.92]} />
        <Material mat={board} />
      </mesh>
    </group>
  )
}

function Moving({
  part,
  open,
  config,
  onToggle,
}: {
  part: Part
  open: boolean
  config: SceneLook
  onToggle: (key: string) => void
}) {
  const anim = useRef<Group>(null)
  const progress = useRef(0)
  const [hot, setHot] = useState(false)
  const swing = part.move === 'swing-left' || part.move === 'swing-right'
  const left = part.move === 'swing-left'
  const right = part.move === 'swing-right'
  const tilt = part.move === 'tilt'
  const pivotX = left
    ? part.pos[0] - part.size[0] / 2
    : right
      ? part.pos[0] + part.size[0] / 2
      : part.pos[0]
  const pivotY = tilt ? part.pos[1] - part.size[1] / 2 : part.pos[1]
  const meshY = tilt ? part.size[1] / 2 : 0
  const pivotZ = part.pos[2]
  const meshX = left ? part.size[0] / 2 : right ? -part.size[0] / 2 : 0
  const plan = part.move && config.handle !== 'none'
    ? handlePlan(part, config.handle, config.handlePos, config.handleSide)
    : null
  const centerAlong = plan && plan.holes.length
    ? plan.holes.reduce((sum, hole) => sum + hole.x, 0) / plan.holes.length
    : 0
  const centerY = plan && plan.holes.length
    ? plan.holes.reduce((sum, hole) => sum + hole.y, 0) / plan.holes.length
    : part.size[1] / 2
  const handlePos: [number, number, number] = [
    right
      ? -part.size[0] + centerAlong
      : left
        ? centerAlong
        : centerAlong - part.size[0] / 2,
    centerY - part.size[1] / 2,
    part.size[2] / 2,
  ]

  useFrame((_, delta) => {
    const group = anim.current
    if (!group) return
    const goal = open ? 1 : 0
    progress.current += (goal - progress.current) * Math.min(1, delta * 8)
    const amount = progress.current
    group.rotation.set(0, 0, 0)
    group.position.set(0, 0, 0)
    if (left) group.rotation.y = -amount * 1.15
    if (right) group.rotation.y = amount * 1.15
    if (part.move === 'slide-left') group.position.x = -amount * Math.min(part.size[0] * 0.6, 0.42)
    if (part.move === 'slide-right') group.position.x = amount * Math.min(part.size[0] * 0.6, 0.42)
    if (part.move === 'drawer') group.position.z = amount * 0.22
    if (tilt) group.rotation.x = amount * 1.05
  })

  const hingeSpots = swing ? hingeHeights(part.size[1]) : []
  const mat = styleFor(part, config)

  return (
    <group position={[pivotX, pivotY, pivotZ]}>
      <group ref={anim}>
        <group position={[0, meshY, 0]}>
        <mesh
          position={[meshX, 0, 0]}
          castShadow
          receiveShadow
          onPointerOver={(event) => {
            event.stopPropagation()
            setHot(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHot(false)
            document.body.style.cursor = 'auto'
          }}
          onClick={(event) => {
            event.stopPropagation()
            onToggle(part.key)
          }}
        >
          <boxGeometry args={part.size} />
          <Material mat={mat} hot={hot} />
        </mesh>
        {tilt && <ShoeTray part={part} config={config} meshX={meshX} />}
        {part.role === 'facade' && (
          <FrameOverlay
            size={part.size}
            meshX={meshX}
            frame={config.frame}
            baseColor={mat.color}
            map={mat.map}
          />
        )}
        {part.role === 'facade' && (
          <MirrorOverlay size={part.size} meshX={meshX} mirror={part.mirror ?? config.mirror} />
        )}
        {plan && (
          <group position={handlePos}>
            <HandleMesh handle={config.handle} config={config} />
          </group>
        )}
        {swing && hingeSpots.map((spot) => {
          const y = spot
          const x = left ? -part.size[0] / 2 + 0.006 : part.size[0] / 2 - 0.006
          return (
            <mesh key={spot} position={[meshX + x, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.008, 0.008, 0.02, 12]} />
              <meshStandardMaterial color="#7a7f86" roughness={0.4} metalness={0.6} />
            </mesh>
          )
        })}
        </group>
      </group>
    </group>
  )
}

function Still({ part, config }: { part: Part; config: SceneLook }) {
  const mat = styleFor(part, config)
  const cyl = part.shape === 'cyl'
  const radius = Math.min(part.size[0], part.size[2]) / 2
  return (
    <mesh position={part.pos} castShadow receiveShadow>
      {cyl ? (
        <cylinderGeometry args={[radius, radius, part.size[1], 20]} />
      ) : (
        <boxGeometry args={part.size} />
      )}
      <Material mat={mat} />
    </mesh>
  )
}

function Rulers({ dims }: { dims: Span }) {
  const y = 0.02
  const z = dims.d / 2 + 0.38
  const x = dims.w / 2 + 0.24
  return (
    <group>
      <Html position={[0, -2, 0]} style={{ display: 'none' }}>
        <span />
      </Html>
      <mesh position={[0, y, z]}>
        <boxGeometry args={[dims.w, 0.005, 0.005]} />
        <meshBasicMaterial color="#6d5848" />
      </mesh>
      <mesh position={[-dims.w / 2, y, z]}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshBasicMaterial color="#6d5848" />
      </mesh>
      <mesh position={[dims.w / 2, y, z]}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshBasicMaterial color="#6d5848" />
      </mesh>
      <mesh position={[-x, dims.h / 2, dims.d / 2]}>
        <boxGeometry args={[0.005, dims.h, 0.005]} />
        <meshBasicMaterial color="#6d5848" />
      </mesh>
      <Html position={[-x, dims.h / 2, dims.d / 2 + 0.01]} center style={{ pointerEvents: 'none' }}>
        <div className="dim">высота {Math.round(dims.h * 1000)} мм</div>
      </Html>
      <mesh position={[x, y, 0]}>
        <boxGeometry args={[0.005, 0.005, dims.d]} />
        <meshBasicMaterial color="#6d5848" />
      </mesh>
      <Html position={[x, y + 0.07, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="dim">глубина {Math.round(dims.d * 1000)} мм</div>
      </Html>
      <Html position={[0, 0.28, z]} center style={{ pointerEvents: 'none' }}>
        <div className="dim">ширина {Math.round(dims.w * 1000)} мм</div>
      </Html>
    </group>
  )
}

function cameraFor(dims: Span): [number, number, number] {
  const distH = (dims.h / 2 + 0.28) / Math.tan((34 * Math.PI) / 360)
  const distW = (dims.w / 2 + 0.9) / Math.tan((24 * Math.PI) / 180)
  const dist = Math.max(distH, distW, 2.6)
  return [dist * 0.38, dims.h * 0.48, dist * 0.92]
}

export function Stage({
  config,
  compiled,
  open,
  shot,
  onToggle,
}: {
  config: SceneLook
  compiled: Compiled
  open: Record<string, boolean>
  shot: number
  onToggle: (key: string) => void
}) {
  const frame = {
    w: Math.max(compiled.span.w, compiled.dims.w),
    h: Math.max(compiled.span.h, compiled.dims.h),
    d: Math.max(compiled.span.d, compiled.dims.d),
  }

  return (
    <Canvas
      key={shot}
      shadows
      dpr={[1, 1.75]}
      camera={{ position: cameraFor(frame), fov: 34 }}
    >
      <color attach="background" args={['#e7e0d4']} />
      <hemisphereLight args={['#fff6ea', '#cbb89f', 0.72]} />
      <ambientLight intensity={0.22} />
      <directionalLight
        position={[4.5, 7.5, 5]}
        intensity={1.85}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.4}
        shadow-camera-far={28}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.00035}
      />
      <directionalLight position={[-5, 4, -2]} intensity={0.38} color="#d5e2ff" />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#e3d5c4" roughness={0.96} />
      </mesh>
      <mesh position={[0, 1.75, -frame.d / 2 - 0.55]} receiveShadow>
        <planeGeometry args={[Math.max(frame.w + 4, 9), 3.7]} />
        <meshStandardMaterial color="#f6f2ea" roughness={1} />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.28} scale={14} blur={2.2} far={5} color="#6d5848" frames={1} />
      {compiled.parts.filter((part) => !part.ghost).map((part) => (
        part.move
          ? <Moving key={part.key} part={part} open={Boolean(open[part.key])} config={config} onToggle={onToggle} />
          : <Still key={part.key} part={part} config={config} />
      ))}
      <Rulers dims={compiled.dims} />
      <OrbitControls
        makeDefault
        target={[0, frame.h * 0.46, 0]}
        maxPolarAngle={Math.PI / 2.04}
        minDistance={0.9}
        maxDistance={14}
        enableDamping
      />
    </Canvas>
  )
}
