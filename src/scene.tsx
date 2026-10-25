import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import { CanvasTexture, DoubleSide, RepeatWrapping, SRGBColorSpace, type Group } from 'three'
import { handlePlan, hingeHeights, type Compiled, type HandleSlot, type Part, type Span } from './geometry'
import { jobFor } from './pattern/jobs'
import { PatternOverlay } from './pattern/overlay'
import {
  boards,
  colors,
  findById,
  finishes,
  type BoardId,
  type ColorId,
  type SceneLook,
} from './model'
import {
  defaultRoomPlan,
  mainPlacement,
  roomSizeForOpening,
  roomSizeForProduct,
} from './room/plan'
import type { Envelope } from './survey/model'

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

function styleFor(part: Part, config: SceneLook, host?: Part): Mat {
  const carcassBoard = findById(boards, config.carcassBoard)
  const facadeBoard = findById(boards, config.facadeBoard)
  const carcassHex = findById(colors, config.carcassColor).hex
  const facadeHex = findById(colors, config.facadeColor).hex
  const finish = findById(finishes, config.finish)

  if (part.role === 'metal') {
    return { color: finish.color, roughness: finish.roughness, metalness: finish.metalness }
  }

  // Ящик на фасаде красится цветом фасада (обувница / откидные).
  const painted = part.role === 'facade' || (part.role === 'carcass' && host?.role === 'facade')
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

function Material({
  mat,
  hot,
  picked,
  twoSided,
}: {
  mat: Mat
  hot?: boolean
  picked?: boolean
  twoSided?: boolean
}) {
  return (
    <meshStandardMaterial
      color={mat.map ? '#ffffff' : mat.color}
      map={mat.map ?? null}
      roughness={mat.roughness}
      metalness={mat.metalness}
      emissive={picked ? '#e28a45' : hot ? '#ffffff' : '#000000'}
      emissiveIntensity={picked ? 0.22 : hot ? 0.14 : 0}
      side={twoSided ? DoubleSide : undefined}
    />
  )
}

function FinishMaterial({ config }: { config: SceneLook }) {
  const finish = findById(finishes, config.finish)
  return <meshStandardMaterial color={finish.color} roughness={finish.roughness} metalness={finish.metalness} />
}

function CutSlot({
  size,
  slot,
}: {
  size: [number, number, number]
  slot: HandleSlot
}) {
  const x = slot.x - size[0] / 2
  const y = slot.y - size[1] / 2
  const deep = size[2] + 0.006
  const mid = Math.max(0.002, slot.w - slot.h)
  const r = slot.h / 2
  return (
    <group position={[x, y, 0]}>
      <mesh>
        <boxGeometry args={[mid, slot.h, deep]} />
        <meshBasicMaterial color="#14110e" />
      </mesh>
      <mesh position={[-mid / 2, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, deep, 16]} />
        <meshBasicMaterial color="#14110e" />
      </mesh>
      <mesh position={[mid / 2, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, deep, 16]} />
        <meshBasicMaterial color="#14110e" />
      </mesh>
    </group>
  )
}

function HandleMesh({ handle, config }: { handle: SceneLook['handle']; config: SceneLook }) {
  if (handle === 'none' || handle === 'cut') return null
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
        map={map ?? null}
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

function localOnTilt(parent: Part, child: Part): [number, number, number] {
  return [
    child.pos[0] - parent.pos[0],
    child.pos[1] - (parent.pos[1] - parent.size[1] / 2),
    child.pos[2] - (parent.pos[2] + parent.size[2] / 2),
  ]
}

function localOnDrawer(parent: Part, child: Part): [number, number, number] {
  return [
    child.pos[0] - parent.pos[0],
    child.pos[1] - parent.pos[1],
    child.pos[2] - parent.pos[2],
  ]
}

function HostedPart({
  parent,
  part,
  config,
  mode,
}: {
  parent: Part
  part: Part
  config: SceneLook
  mode: 'tilt' | 'drawer'
}) {
  const mat = styleFor(part, config, parent)
  const alongX = part.axis === 'x'
  const radius = Math.min(part.size[1], part.size[2]) / 2
  const pitch = part.pitch ?? 0
  const position = mode === 'tilt' ? localOnTilt(parent, part) : localOnDrawer(parent, part)
  return (
    <mesh
      position={position}
      rotation={alongX ? [pitch, 0, Math.PI / 2] : [pitch, 0, 0]}
      castShadow
    >
      {part.shape === 'cyl' ? (
        <cylinderGeometry args={[radius, radius, alongX ? part.size[0] : part.size[1], 16]} />
      ) : (
        <boxGeometry args={part.size} />
      )}
      <Material mat={mat} />
    </mesh>
  )
}

function Moving({
  part,
  extras,
  open,
  config,
  mill,
  picked,
  onPick,
}: {
  part: Part
  extras: Part[]
  open: boolean
  config: SceneLook
  mill: Compiled['mill']
  picked: boolean
  onPick: (key: string) => void
}) {
  const anim = useRef<Group>(null)
  const progress = useRef(0)
  const [hot, setHot] = useState(false)
  const swing = part.move === 'swing-left' || part.move === 'swing-right'
  const left = part.move === 'swing-left'
  const right = part.move === 'swing-right'
  const tilt = part.move === 'tilt'
  const drawer = part.move === 'drawer'
  const travel = part.travel ?? 0.22
  const pivotX = left
    ? part.pos[0] - part.size[0] / 2
    : right
      ? part.pos[0] + part.size[0] / 2
      : part.pos[0]
  const pivotY = tilt ? part.pos[1] - part.size[1] / 2 : part.pos[1]
  const meshY = tilt ? part.size[1] / 2 : 0
  const meshZ = tilt ? -part.size[2] / 2 : 0
  const pivotZ = tilt ? part.pos[2] + part.size[2] / 2 : part.pos[2]
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
    if (drawer) group.position.z = amount * travel
    if (tilt) group.rotation.x = amount * 1.05
  })

  const hingeSpots = swing ? hingeHeights(part.size[1]) : []
  const mat = styleFor(part, config)

  return (
    <group position={[pivotX, pivotY, pivotZ]}>
      <group ref={anim}>
        <group position={[0, meshY, meshZ]}>
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
            if (part.role === 'facade') onPick(part.key)
          }}
        >
          <boxGeometry args={part.size} />
          <Material mat={mat} hot={hot} picked={picked} />
        </mesh>
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
          <PatternOverlay size={part.size} meshX={meshX} job={jobFor(mill, part.key)} />
        )}
        {part.role === 'facade' && (
          <MirrorOverlay size={part.size} meshX={meshX} mirror={part.mirror ?? config.mirror} />
        )}
        {plan?.slot && (
          <group position={[meshX, 0, 0]}>
            <CutSlot size={part.size} slot={plan.slot} />
          </group>
        )}
        {plan && !plan.slot && (
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
        {tilt && extras.map((extra) => (
          <HostedPart key={extra.key} parent={part} part={extra} config={config} mode="tilt" />
        ))}
        {drawer && extras.map((extra) => (
          <HostedPart key={extra.key} parent={part} part={extra} config={config} mode="drawer" />
        ))}
      </group>
    </group>
  )
}

function Still({
  part,
  config,
  mill,
  picked,
  onPick,
}: {
  part: Part
  config: SceneLook
  mill: Compiled['mill']
  picked: boolean
  onPick: (key: string) => void
}) {
  const mat = styleFor(part, config)
  const cyl = part.shape === 'cyl'
  const alongX = part.axis === 'x'
  const radius = alongX
    ? Math.min(part.size[1], part.size[2]) / 2
    : Math.min(part.size[0], part.size[2]) / 2
  const facade = part.role === 'facade' && !cyl
  return (
    <group position={part.pos} rotation={alongX ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
      <mesh
        castShadow
        receiveShadow
        onClick={facade ? (event) => {
          event.stopPropagation()
          onPick(part.key)
        } : undefined}
      >
        {cyl ? (
          <cylinderGeometry args={[radius, radius, alongX ? part.size[0] : part.size[1], 20]} />
        ) : (
          <boxGeometry args={part.size} />
        )}
        <Material mat={mat} picked={picked} />
      </mesh>
      {facade && <PatternOverlay size={part.size} meshX={0} job={jobFor(mill, part.key)} />}
    </group>
  )
}

function Rulers({ dims, roomH, roomLabel }: { dims: Span; roomH: number; roomLabel: string }) {
  const y = 0.02
  const z = dims.d / 2 + 0.38
  const x = dims.w / 2 + 0.24
  const roomX = -Math.max(dims.w / 2 + 0.55, 0.9)
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
      <mesh position={[roomX, roomH / 2, dims.d / 2]}>
        <boxGeometry args={[0.006, roomH, 0.006]} />
        <meshBasicMaterial color="#8a7364" />
      </mesh>
      <mesh position={[roomX, 0.01, dims.d / 2]}>
        <boxGeometry args={[0.014, 0.014, 0.014]} />
        <meshBasicMaterial color="#8a7364" />
      </mesh>
      <mesh position={[roomX, roomH, dims.d / 2]}>
        <boxGeometry args={[0.014, 0.014, 0.014]} />
        <meshBasicMaterial color="#8a7364" />
      </mesh>
      <Html position={[roomX, roomH * 0.72, dims.d / 2 + 0.02]} center style={{ pointerEvents: 'none' }}>
        <div className="dim">{roomLabel}</div>
      </Html>
    </group>
  )
}

function RoomPlinth({ w, d, height, deep }: { w: number; d: number; height: number; deep: number }) {
  const color = '#b8894a'
  const span = Math.max(w, deep * 2 + 0.02)
  const side = span / 2 - deep / 2
  return (
    <group>
      <mesh position={[0, height / 2, -d / 2 + deep / 2]}>
        <boxGeometry args={[Math.max(span - deep * 2, 0.02), height, deep]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
      <mesh position={[-side, height / 2, 0]}>
        <boxGeometry args={[deep, height, d]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
      <mesh position={[side, height / 2, 0]}>
        <boxGeometry args={[deep, height, d]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
    </group>
  )
}

/** Пол и стены. Размер приходит снаружи: от изделия или от проёма. */
function Room({
  size,
  trim,
  skirt,
}: {
  size: { w: number; d: number; h: number }
  trim: boolean
  skirt: { height: number; deep: number } | null
}) {
  const roomW = size.w
  const roomD = size.d
  const roomH = size.h
  const backZ = -roomD / 2
  const wallT = 0.04
  const floorY = 0
  const ceilY = roomH
  const backWall = '#e8ecf1'
  const sideWall = '#eef1f5'
  const floorColor = '#e6ddd0'
  const ceilColor = '#f7f9fb'
  const base = '#c5cdd6'

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, floorY, 0]} receiveShadow>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color={floorColor} roughness={0.96} />
      </mesh>
      <mesh position={[0, ceilY, 0]} rotation-x={Math.PI / 2} receiveShadow>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color={ceilColor} roughness={1} side={DoubleSide} />
      </mesh>
      <mesh position={[0, roomH / 2, backZ]} receiveShadow>
        <planeGeometry args={[roomW, roomH]} />
        <meshStandardMaterial color={backWall} roughness={0.92} />
      </mesh>
      <mesh position={[-roomW / 2, roomH / 2, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[roomD, roomH]} />
        <meshStandardMaterial color={sideWall} roughness={0.94} />
      </mesh>
      <mesh position={[roomW / 2, roomH / 2, 0]} rotation-y={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[roomD, roomH]} />
        <meshStandardMaterial color="#e9edf2" roughness={0.94} />
      </mesh>
      {trim && (
        <>
          <mesh position={[0, 0.04, backZ + wallT / 2]}>
            <boxGeometry args={[roomW - 0.02, 0.08, wallT]} />
            <meshStandardMaterial color={base} roughness={0.9} />
          </mesh>
          <mesh position={[-roomW / 2 + wallT / 2, 0.04, 0]}>
            <boxGeometry args={[wallT, 0.08, roomD - 0.02]} />
            <meshStandardMaterial color={base} roughness={0.9} />
          </mesh>
          <mesh position={[roomW / 2 - wallT / 2, 0.04, 0]}>
            <boxGeometry args={[wallT, 0.08, roomD - 0.02]} />
            <meshStandardMaterial color={base} roughness={0.9} />
          </mesh>
        </>
      )}
      {skirt ? <RoomPlinth w={roomW} d={roomD} height={skirt.height} deep={skirt.deep} /> : null}
    </group>
  )
}

function cameraFor(dims: Span): [number, number, number] {
  const distH = (dims.h / 2 + 0.28) / Math.tan((34 * Math.PI) / 360)
  const distW = (dims.w / 2 + 0.9) / Math.tan((24 * Math.PI) / 180)
  const dist = Math.max(distH, distW, 2.6)
  return [dist * 0.38, dims.h * 0.48, dist * 0.92]
}

const PERSON_H = 1.75

function LimbMat({ color, rough = 0.82 }: { color: string; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={0.03} />
}

/**
 * Масштабный человек 175 см в духе archviz-манекена.
 * Без «лица» — только силуэт, смотрит на изделие.
 */
function ScalePerson({ product, height }: { product: Span; height: number }) {
  const s = height / PERSON_H
  const body = '#6e7278'
  const dark = '#4d5158'
  const light = '#8a8e94'

  const footH = 0.025 * s
  const shinH = 0.43 * s
  const thighH = 0.44 * s
  const pelvisH = 0.14 * s
  const torsoH = 0.48 * s
  const neckH = 0.06 * s
  const headR = 0.1 * s
  const shoulderW = 0.4 * s
  const hipW = 0.28 * s
  const stance = 0.085 * s

  const ankleY = footH
  const kneeY = ankleY + shinH
  const hipY = kneeY + thighH
  const waistY = hipY + pelvisH
  const shoulderY = waistY + torsoH
  const headY = height - headR

  const x = product.w / 2 + 0.5
  const z = Math.max(0.1, product.d / 2 - 0.04)

  function Leg({ side }: { side: 1 | -1 }) {
    return (
      <group position={[side * stance, 0, 0]}>
        <mesh position={[0, footH / 2, 0.06 * s]} castShadow receiveShadow>
          <boxGeometry args={[0.08 * s, footH, 0.22 * s]} />
          <LimbMat color={dark} rough={0.9} />
        </mesh>
        <mesh position={[0, (ankleY + kneeY) / 2, 0]} castShadow>
          <capsuleGeometry args={[0.042 * s, shinH - 0.08 * s, 6, 14]} />
          <LimbMat color={dark} />
        </mesh>
        <mesh position={[0, kneeY, 0]} castShadow>
          <sphereGeometry args={[0.048 * s, 14, 12]} />
          <LimbMat color={dark} />
        </mesh>
        <mesh position={[0, (kneeY + hipY) / 2, 0]} castShadow>
          <capsuleGeometry args={[0.055 * s, thighH - 0.1 * s, 6, 14]} />
          <LimbMat color={dark} />
        </mesh>
      </group>
    )
  }

  function Arm({ side }: { side: 1 | -1 }) {
    const upper = 0.3 * s
    const lower = 0.27 * s
    return (
      <group
        position={[side * (shoulderW / 2 - 0.01 * s), shoulderY - 0.02 * s, 0]}
        rotation={[0.2, 0, side * 0.12]}
      >
        <mesh castShadow>
          <sphereGeometry args={[0.05 * s, 14, 12]} />
          <LimbMat color={body} />
        </mesh>
        <mesh position={[0, -upper / 2, 0]} castShadow>
          <capsuleGeometry args={[0.035 * s, upper - 0.07 * s, 6, 14]} />
          <LimbMat color={body} />
        </mesh>
        <group position={[0, -upper, 0]} rotation={[0.28, 0, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.036 * s, 12, 10]} />
            <LimbMat color={light} />
          </mesh>
          <mesh position={[0, -lower / 2, 0]} castShadow>
            <capsuleGeometry args={[0.03 * s, lower - 0.06 * s, 6, 14]} />
            <LimbMat color={light} />
          </mesh>
          <mesh position={[0, -lower - 0.01 * s, 0.015 * s]} castShadow>
            <boxGeometry args={[0.055 * s, 0.022 * s, 0.12 * s]} />
            <LimbMat color={light} rough={0.75} />
          </mesh>
        </group>
      </group>
    )
  }

  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      <Leg side={-1} />
      <Leg side={1} />

      <mesh position={[0, hipY + pelvisH * 0.4, 0]} castShadow>
        <boxGeometry args={[hipW, pelvisH, 0.18 * s]} />
        <LimbMat color={dark} />
      </mesh>

      <mesh position={[0, waistY + torsoH * 0.5, 0.01 * s]} castShadow>
        <boxGeometry args={[0.34 * s, torsoH, 0.2 * s]} />
        <LimbMat color={body} />
      </mesh>
      <mesh position={[0, shoulderY - 0.02 * s, 0]} castShadow>
        <boxGeometry args={[shoulderW, 0.09 * s, 0.16 * s]} />
        <LimbMat color={body} />
      </mesh>
      <mesh position={[-shoulderW / 2 + 0.02 * s, shoulderY - 0.01 * s, 0]} castShadow>
        <sphereGeometry args={[0.055 * s, 14, 12]} />
        <LimbMat color={body} />
      </mesh>
      <mesh position={[shoulderW / 2 - 0.02 * s, shoulderY - 0.01 * s, 0]} castShadow>
        <sphereGeometry args={[0.055 * s, 14, 12]} />
        <LimbMat color={body} />
      </mesh>

      <Arm side={-1} />
      <Arm side={1} />

      <mesh position={[0, shoulderY + neckH * 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.042 * s, 0.048 * s, neckH, 16]} />
        <LimbMat color={light} rough={0.75} />
      </mesh>

      {/* Гладкая голова-манекен, без морды — ориентация на изделие */}
      <group position={[0, headY, 0.01 * s]}>
        <mesh castShadow>
          <sphereGeometry args={[headR, 28, 20]} />
          <LimbMat color={light} rough={0.7} />
        </mesh>
        {/* Лёгкий овал лица вперёд — читается взгляд без черт */}
        <mesh position={[0, -0.01 * s, headR * 0.35]} castShadow>
          <sphereGeometry args={[headR * 0.78, 20, 16]} />
          <LimbMat color={light} rough={0.7} />
        </mesh>
      </group>

      <Html position={[0, height + 0.1, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="dim">человек {Math.round(height * 100)} см</div>
      </Html>
    </group>
  )
}

function NicheGaps({
  opening,
  product,
  shiftZ,
}: {
  opening: Envelope
  product: Span
  shiftZ: number
}) {
  const roomW = opening.openingW / 1000
  const roomH = opening.openingH / 1000
  const roomD = opening.openingD / 1000
  const side = (roomW - product.w) / 2
  const top = roomH - product.h
  const back = roomD - product.d
  return (
    <group>
      {side > 0.001 && (
        <>
          <mesh position={[-roomW / 2 + side / 2, product.h / 2, shiftZ]}>
            <boxGeometry args={[Math.max(side, 0.001), product.h, product.d]} />
            <meshStandardMaterial color="#e28a45" transparent opacity={0.35} />
          </mesh>
          <mesh position={[roomW / 2 - side / 2, product.h / 2, shiftZ]}>
            <boxGeometry args={[Math.max(side, 0.001), product.h, product.d]} />
            <meshStandardMaterial color="#e28a45" transparent opacity={0.35} />
          </mesh>
        </>
      )}
      {back > 0.001 && (
        <mesh position={[0, product.h / 2, -roomD / 2 + back / 2]}>
          <boxGeometry args={[product.w, product.h, back]} />
          <meshStandardMaterial color="#e28a45" transparent opacity={0.28} />
        </mesh>
      )}
      <Html position={[0, roomH + 0.08, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="dim">
          проём {opening.openingW} × {opening.openingH} × {opening.openingD} мм
        </div>
      </Html>
      <Html position={[0, product.h + Math.min(0.12, Math.max(top, 0.04) / 2), shiftZ]} center style={{ pointerEvents: 'none' }}>
        <div className="dim">
          щель {Math.round(side * 1000)} мм/сторона · сверху {Math.round(top * 1000)} мм
        </div>
      </Html>
    </group>
  )
}

export function Stage({
  config,
  compiled,
  open,
  shot,
  opening,
  pickedKey,
  onPickPart,
}: {
  config: SceneLook
  compiled: Compiled
  open: Record<string, boolean>
  shot: number
  opening: Envelope | null
  pickedKey: string | null
  onPickPart: (key: string) => void
}) {
  const [showPerson, setShowPerson] = useState(false)
  const roomPlan = defaultRoomPlan
  const place = mainPlacement(roomPlan)
  const frame = {
    w: Math.max(compiled.span.w, compiled.dims.w),
    h: Math.max(compiled.span.h, compiled.dims.h),
    d: Math.max(compiled.span.d, compiled.dims.d),
  }
  const body = compiled.dims
  const roomSize = opening ? roomSizeForOpening(opening) : roomSizeForProduct(frame, roomPlan)
  const shiftZ = opening ? (roomSize.d - body.d) / 2 : place.z
  const view = {
    w: Math.max(frame.w, roomSize.w),
    h: Math.max(frame.h, roomSize.h),
    d: Math.max(frame.d, roomSize.d),
  }
  const roomLabel = opening
    ? `проём ${opening.openingH} мм`
    : `потолок ${Math.round(roomSize.h * 100)} см`
  const skirt = opening && opening.skirtingHeight > 0 && opening.skirtingWidth > 0
    ? {
        height: opening.skirtingHeight / 1000,
        deep: opening.skirtingWidth / 1000,
        sideGap: (opening.openingW - body.w * 1000) / 2,
        backGap: opening.openingD - body.d * 1000,
      }
    : null
  const skirtHits = skirt != null && (skirt.deep * 1000 > skirt.sideGap || skirt.deep * 1000 > skirt.backGap)

  return (
    <div className="stage">
      <Canvas
        key={shot}
        shadows
        dpr={[1, 1.75]}
        camera={{ position: cameraFor(view), fov: 34 }}
      >
        <color attach="background" args={['#e9edf2']} />
        <hemisphereLight args={['#f5f8fb', '#d4c4b0', 0.85]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[4.5, 7.5, 5]}
          intensity={1.55}
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
        <Room size={roomSize} trim={!opening} skirt={skirt} />
        <ContactShadows position={[0, 0.001, 0]} opacity={0.28} scale={14} blur={2.2} far={5} color="#6d5848" frames={1} />
        {opening && <NicheGaps opening={opening} product={body} shiftZ={shiftZ} />}
        <group position={[place.x, 0, shiftZ]} rotation-y={place.yaw}>
          {compiled.parts.filter((part) => !part.ghost && !part.host).map((part) => (
            part.move
              ? (
                <Moving
                  key={part.key}
                  part={part}
                  extras={compiled.parts.filter((extra) => extra.host === part.key)}
                  open={Boolean(open[part.key])}
                  config={config}
                  mill={compiled.mill ?? []}
                  picked={pickedKey === part.key}
                  onPick={onPickPart}
                />
              )
              : (
                <Still
                  key={part.key}
                  part={part}
                  config={config}
                  mill={compiled.mill ?? []}
                  picked={pickedKey === part.key}
                  onPick={onPickPart}
                />
              )
          ))}
        </group>
        {showPerson && <ScalePerson product={compiled.dims} height={PERSON_H} />}
        <Rulers dims={compiled.dims} roomH={roomSize.h} roomLabel={roomLabel} />
        <OrbitControls
          makeDefault
          target={[0, view.h * 0.46, 0]}
          maxPolarAngle={Math.PI / 2.04}
          minDistance={0.9}
          maxDistance={14}
          enableDamping
        />
      </Canvas>
      {!opening && <div className="stage-note">Без привязки к месту</div>}
      {opening?.outOfSquare && <div className="stage-note warn">Проём не прямой</div>}
      {skirtHits && (
        <div className={opening?.outOfSquare ? 'stage-note warn second' : 'stage-note warn'}>
          Плинтус выпирает в изделие
        </div>
      )}
      <label className="person-toggle">
        <input
          type="checkbox"
          checked={showPerson}
          onChange={(event) => setShowPerson(event.target.checked)}
        />
        <span>Человек 175 см</span>
      </label>
    </div>
  )
}
