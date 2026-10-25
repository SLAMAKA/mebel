import { useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { DoubleSide, Matrix4, Shape, Vector3 } from 'three'
import type { Mesh, PerspectiveCamera } from 'three'
import type { SurveyFields } from './model'

type Vec = [number, number, number]

function liveMm(raw: string) {
  const text = raw.trim().replace(',', '.')
  if (!text) return 0
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return 0
  return value
}

function known(values: number[], fallback: number) {
  const hit = values.find((value) => value > 0)
  return values.map((value) => (value > 0 ? value : hit ?? fallback))
}

function meters(mm: number, min: number, max: number) {
  return Math.min(max, Math.max(min, mm)) / 1000
}

function spot(a: Vec, b: Vec, t: number, shift: Vec): Vec {
  return [
    a[0] + (b[0] - a[0]) * t + shift[0],
    a[1] + (b[1] - a[1]) * t + shift[1],
    a[2] + (b[2] - a[2]) * t + shift[2],
  ]
}

function frameCamera(w: number, h: number, d: number, aspect = 1): [number, number, number] {
  const vHalf = (34 * Math.PI) / 360
  const distH = (h / 2 + 0.85) / Math.tan(vHalf)
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(aspect, 0.35))
  const distW = (w / 2 + 1.5) / Math.tan(hHalf)
  const dist = Math.max(distH, distW, d + 2.6, 3.6)
  return [dist * 0.18, h * 0.42, dist]
}

const axisX = new Vector3(1, 0, 0)
const scratchA = new Vector3()
const scratchB = new Vector3()
const scratchC = new Vector3()
const scratchD = new Vector3()
const scratchE = new Vector3()
const backDir = new Vector3()
const scratchBasis = new Matrix4()

const arrowShape = new Shape()
arrowShape.moveTo(0, 0.5)
arrowShape.lineTo(-0.4, -0.5)
arrowShape.lineTo(0.4, -0.5)
arrowShape.closePath()

const DASHES = 24

function worldPx(camera: PerspectiveCamera, distance: number, height: number, px: number) {
  const fov = (camera.fov * Math.PI) / 360
  return (2 * Math.tan(fov) * distance * px) / Math.max(height, 1)
}

function faceCamera(mesh: Mesh, tip: Vector3, dir: Vector3, camera: PerspectiveCamera) {
  const toCam = scratchA.copy(camera.position).sub(tip)
  const normal = scratchB.copy(toCam)
  normal.addScaledVector(dir, -toCam.dot(dir))
  if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1)
  else normal.normalize()
  const side = scratchC.crossVectors(dir, normal)
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0)
  else side.normalize()
  scratchBasis.makeBasis(side, dir, normal)
  mesh.quaternion.setFromRotationMatrix(scratchBasis)
}

function placeHead(
  mesh: Mesh | null,
  tip: Vector3,
  dir: Vector3,
  len: number,
  camera: PerspectiveCamera,
) {
  if (!mesh) return
  if (len < 0.001) {
    mesh.visible = false
    return
  }
  const toCam = scratchA.copy(camera.position).sub(tip)
  const aimed = Math.abs(dir.dot(toCam)) / (toCam.length() || 1) > 0.82
  if (aimed) {
    scratchB.set(0, 1, 0)
    const side = scratchC.crossVectors(dir, scratchB)
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
    else side.normalize()
    scratchBasis.makeBasis(side, dir, scratchB)
    mesh.quaternion.setFromRotationMatrix(scratchBasis)
  } else {
    faceCamera(mesh, tip, dir, camera)
  }
  mesh.scale.set(len, len, 1)
  mesh.position.copy(tip).addScaledVector(dir, -len / 2)
  mesh.visible = true
}

function placeShaft(
  mesh: Mesh | null,
  start: Vector3,
  dir: Vector3,
  span: number,
  inset: number,
  thick: number,
) {
  if (!mesh) return
  const draw = Math.max(span - inset * 2, 0.001)
  scratchE.copy(start).addScaledVector(dir, inset + draw / 2)
  mesh.position.copy(scratchE)
  mesh.quaternion.setFromUnitVectors(axisX, dir)
  mesh.scale.set(draw, thick, thick)
  mesh.visible = draw > 0.004
}

function arm(mesh: Mesh) {
  if (mesh.userData.armed) return
  mesh.userData.armed = true
  mesh.scale.setScalar(0.0001)
  mesh.visible = false
}

function hideMeshes(meshes: Array<Mesh | null>) {
  for (const mesh of meshes) {
    if (mesh) mesh.visible = false
  }
}

function placeDashes(
  meshes: Array<Mesh | null>,
  start: Vector3,
  dir: Vector3,
  span: number,
  inset: number,
  thick: number,
  dash: number,
  gap: number,
) {
  const drawEnd = span - inset
  let cursor = inset
  let index = 0
  while (index < meshes.length && cursor < drawEnd - 0.001) {
    const stop = Math.min(drawEnd, cursor + dash)
    const mesh = meshes[index]
    const length = stop - cursor
    if (mesh && length > 0.004) {
      scratchE.copy(start).addScaledVector(dir, cursor + length / 2)
      mesh.position.copy(scratchE)
      mesh.quaternion.setFromUnitVectors(axisX, dir)
      mesh.scale.set(length, thick, thick)
      mesh.visible = true
    }
    cursor += dash + gap
    index += 1
  }
  for (; index < meshes.length; index += 1) {
    const mesh = meshes[index]
    if (mesh) mesh.visible = false
  }
}

function DimBar({
  from,
  to,
  quiet,
  lit,
  onPick,
  onHot,
}: {
  from: Vec
  to: Vec
  quiet?: boolean
  lit: boolean
  onPick: () => void
  onHot: (value: boolean) => void
}) {
  const haloRef = useRef<Mesh>(null)
  const inkRef = useRef<Mesh>(null)
  const hitRef = useRef<Mesh>(null)
  const headA = useRef<Mesh>(null)
  const headB = useRef<Mesh>(null)
  const dashRefs = useRef<Array<Mesh | null>>([])
  const startRef = useRef(new Vector3())
  const endRef = useRef(new Vector3())
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const height = useThree((state) => state.size.height)
  const gl = useThree((state) => state.gl)
  startRef.current.set(from[0], from[1], from[2])
  endRef.current.set(to[0], to[1], to[2])

  useFrame(() => {
    const start = startRef.current
    const end = endRef.current
    const delta = scratchD.copy(end).sub(start)
    const span = delta.length()
    if (span < 0.001) return
    const dir = delta.multiplyScalar(1 / span)
    const mid = scratchE.copy(start).lerp(end, 0.5)
    const dist = camera.position.distanceTo(mid)
    const unit = worldPx(camera, dist, height, 1)
    const view = scratchA.copy(camera.position).sub(mid)
    const viewLen = view.length() || 1
    const along = Math.abs(dir.dot(view) / viewLen)
    const visible = Math.max(span * Math.sqrt(Math.max(0, 1 - along * along)), unit * 28)
    const head = Math.min(unit * (quiet ? 12 : 18), visible * 0.18, span * 0.28)
    backDir.copy(dir).negate()

    if (quiet) {
      if (haloRef.current) haloRef.current.visible = false
      if (inkRef.current) inkRef.current.visible = false
      placeDashes(dashRefs.current, start, dir, span, head, unit * 1.6, unit * 11, unit * 7)
    } else {
      hideMeshes(dashRefs.current)
      placeShaft(haloRef.current, start, dir, span, head, unit * (lit ? 5 : 4))
      placeShaft(inkRef.current, start, dir, span, head, unit * (lit ? 2.2 : 1.7))
    }
    placeShaft(hitRef.current, start, dir, span, 0, unit * (quiet ? 16 : 22))
    placeHead(headA.current, start, backDir, head, camera)
    placeHead(headB.current, end, dir, head, camera)
  })

  function pick(event: { stopPropagation: () => void }) {
    event.stopPropagation()
    onPick()
  }

  const color = lit ? '#e28a45' : quiet ? '#8a7564' : '#3c322b'
  const halo = lit ? '#ffd7b8' : '#f6f1e8'
  const lineMaterial = {
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  }

  return (
    <group>
      <mesh ref={haloRef} renderOrder={2} frustumCulled={false} onUpdate={arm}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={halo} {...lineMaterial} />
      </mesh>
      <mesh ref={inkRef} renderOrder={3} frustumCulled={false} onUpdate={arm}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={color} {...lineMaterial} />
      </mesh>
      {quiet
        ? Array.from({ length: DASHES }, (_, index) => (
            <mesh
              key={index}
              ref={(node) => {
                dashRefs.current[index] = node
              }}
              renderOrder={3}
              frustumCulled={false}
              onUpdate={arm}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial color={color} {...lineMaterial} />
            </mesh>
          ))
        : null}
      <mesh ref={headA} renderOrder={5} frustumCulled={false} onUpdate={arm}>
        <shapeGeometry args={[arrowShape]} />
        <meshBasicMaterial color={color} side={DoubleSide} {...lineMaterial} />
      </mesh>
      <mesh ref={headB} renderOrder={5} frustumCulled={false} onUpdate={arm}>
        <shapeGeometry args={[arrowShape]} />
        <meshBasicMaterial color={color} side={DoubleSide} {...lineMaterial} />
      </mesh>
      <mesh
        ref={hitRef}
        renderOrder={6}
        frustumCulled={false}
        onUpdate={arm}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerOver={(event) => {
          event.stopPropagation()
          onHot(true)
          gl.domElement.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          onHot(false)
          gl.domElement.style.cursor = ''
        }}
        onClick={pick}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Witness({ from, to }: { from: Vec; to: Vec }) {
  const ref = useRef<Mesh>(null)
  const startRef = useRef(new Vector3())
  const endRef = useRef(new Vector3())
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const viewH = useThree((state) => state.size.height)
  startRef.current.set(from[0], from[1], from[2])
  endRef.current.set(to[0], to[1], to[2])

  useFrame(() => {
    const start = startRef.current
    const end = endRef.current
    const delta = scratchD.copy(end).sub(start)
    const span = delta.length()
    const mesh = ref.current
    if (!mesh || span < 0.001) return
    const dir = delta.multiplyScalar(1 / span)
    const dist = camera.position.distanceTo(scratchE.copy(start).lerp(end, 0.5))
    const unit = worldPx(camera, dist, viewH, 1)
    placeShaft(mesh, start, dir, span, unit * 3, unit * 1.15)
  })

  return (
    <mesh ref={ref} renderOrder={1} frustumCulled={false} onUpdate={arm}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#c9baab" />
    </mesh>
  )
}

function Mark({
  from,
  to,
  label,
  value,
  placeholder,
  at,
  quiet,
  autoFocus,
  onChange,
  onTyping,
}: {
  from: Vec
  to: Vec
  label: string
  value: string
  placeholder?: string
  at?: Vec
  quiet?: boolean
  autoFocus?: boolean
  onChange: (value: string) => void
  onTyping: (value: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [hot, setHot] = useState(false)
  const [focus, setFocus] = useState(false)
  const lit = hot || focus
  return (
    <group>
      <DimBar
        from={from}
        to={to}
        quiet={quiet}
        lit={lit}
        onPick={() => input.current?.focus()}
        onHot={setHot}
      />
      <Html position={at ?? spot(from, to, 0.5, [0, 0, 0])} center zIndexRange={[20, 0]}>
        <label
          className={lit ? 'dim-edit hot' : 'dim-edit'}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={() => setHot(true)}
          onPointerLeave={() => setHot(false)}
        >
          <input
            ref={input}
            aria-label={label}
            inputMode="decimal"
            value={value}
            placeholder={placeholder ?? 'мм'}
            autoFocus={autoFocus}
            onFocus={() => {
              setFocus(true)
              window.setTimeout(() => onTyping(true), 0)
            }}
            onBlur={() => {
              setFocus(false)
              window.setTimeout(() => onTyping(false), 0)
            }}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </Html>
    </group>
  )
}

function Fit({ w, h, d }: { w: number; h: number; d: number }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const controls = useThree((state) => state.controls) as { target?: Vector3; update?: () => void } | null
  const aspect = size.width / Math.max(size.height, 1)
  const bucket = `${Math.round(w * 4)}-${Math.round(h * 4)}-${Math.round(d * 4)}-${Math.round(aspect * 10)}`
  const seen = useRef('')
  useFrame(() => {
    if (seen.current === bucket) return
    const [x, y, z] = frameCamera(w, h, d, aspect)
    const lookY = h * 0.45
    camera.position.set(x, y, z)
    camera.lookAt(0, lookY, 0)
    if (!controls?.target) return
    controls.target.set(0, lookY, 0)
    controls.update?.()
    seen.current = bucket
  })
  return null
}

function Niche({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w + 0.8, d + 0.8]} />
        <meshStandardMaterial color="#e6ddd0" roughness={0.96} />
      </mesh>
      <mesh position={[0, h / 2, -d / 2]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#e8ecf1" roughness={0.92} />
      </mesh>
      <mesh position={[-w / 2, h / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color="#eef1f5" roughness={0.94} side={DoubleSide} />
      </mesh>
      <mesh position={[w / 2, h / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color="#e9edf2" roughness={0.94} side={DoubleSide} />
      </mesh>
    </group>
  )
}

export function SurveyMarks({
  fields,
  onChange,
}: {
  fields: SurveyFields
  onChange: (key: keyof SurveyFields, value: string) => void
}) {
  const [typing, setTyping] = useState(false)
  const widths = known(
    [liveMm(fields.widthBottom), liveMm(fields.widthMid), liveMm(fields.widthTop)],
    1600,
  )
  const heights = known([liveMm(fields.heightLeft), liveMm(fields.heightRight)], 2400)
  const depth = liveMm(fields.depth) || 600
  const w = meters(Math.max(...widths), 400, 8000)
  const h = meters(Math.max(...heights), 400, 5000)
  const d = meters(depth, 200, 2000)
  const front = d / 2 + 0.05
  const out = 0.36
  const left = -w / 2
  const right = w / 2
  const floor: Vec = [left, 0.03, front + 0.2]
  const floorEnd: Vec = [right, 0.03, front + 0.2]
  const ceil: Vec = [left, h + 0.12, front]
  const ceilEnd: Vec = [right, h + 0.12, front]
  const lowLeft: Vec = [left + 0.12, 0.16, front + 0.04]
  const highRight: Vec = [right - 0.12, h - 0.16, front + 0.04]
  const lowRight: Vec = [right - 0.12, 0.16, front + 0.04]
  const highLeft: Vec = [left + 0.12, h - 0.16, front + 0.04]

  const set = (key: keyof SurveyFields) => (value: string) => onChange(key, value)

  return (
    <div className="stage">
      <Canvas camera={{ position: frameCamera(w, h, d), fov: 34 }} dpr={[1, 1.75]}>
        <color attach="background" args={['#e9edf2']} />
        <hemisphereLight args={['#f5f8fb', '#d4c4b0', 0.9]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 6, 4]} intensity={1.2} />
        <Niche w={w} h={h} d={d} />
        {/* Первый Html теряет содержимое. Пустышка забирает этот сбой. */}
        <Html position={[0, 0, 0]} style={{ display: 'none' }}><span /></Html>
        <Witness from={[left, 0.02, front]} to={floor} />
        <Witness from={[right, 0.02, front]} to={floorEnd} />
        <Witness from={[left, h, front]} to={ceil} />
        <Witness from={[right, h, front]} to={ceilEnd} />
        <Witness from={[left, 0.02, front]} to={[left - out, 0.02, front]} />
        <Witness from={[left, h, front]} to={[left - out, h, front]} />
        <Witness from={[right, 0.02, front]} to={[right + out, 0.02, front]} />
        <Witness from={[right, h, front]} to={[right + out, h, front]} />
        <Witness from={[right, 0.05, -d / 2]} to={[right + 0.52, 0.05, -d / 2]} />
        <Witness from={[right, 0.05, d / 2]} to={[right + 0.52, 0.05, d / 2]} />
        <Mark
          from={floor}
          to={floorEnd}
          at={[0, 0.02, front + 0.62]}
          label="у пола"
          value={fields.widthBottom}
          onChange={set('widthBottom')}
          onTyping={setTyping}
        />
        <Mark
          from={[left, h / 2, front + 0.08]}
          to={[right, h / 2, front + 0.08]}
          at={[0, h / 2, front + 0.48]}
          label="середина"
          value={fields.widthMid}
          onChange={set('widthMid')}
          onTyping={setTyping}
        />
        <Mark
          from={ceil}
          to={ceilEnd}
          at={[0, h + 0.22, 0]}
          label="потолок"
          value={fields.widthTop}
          onChange={set('widthTop')}
          onTyping={setTyping}
        />
        <Mark
          from={[left - out, 0.02, front]}
          to={[left - out, h, front]}
          at={[left - out - 0.12, h * 0.7, front + 0.45]}
          label="слева"
          value={fields.heightLeft}
          onChange={set('heightLeft')}
          onTyping={setTyping}
        />
        <Mark
          from={[right + out, 0.02, front]}
          to={[right + out, h, front]}
          at={[right + out + 0.22, h * 0.7, front + 0.4]}
          label="справа"
          value={fields.heightRight}
          onChange={set('heightRight')}
          onTyping={setTyping}
        />
        <Mark
          from={[right + 0.52, 0.05, -d / 2]}
          to={[right + 0.52, 0.05, d / 2]}
          at={[right + 0.78, 0.22, 0.05]}
          label="глубина"
          value={fields.depth}
          onChange={set('depth')}
          onTyping={setTyping}
        />
        <Mark
          from={[left + 0.08, 0.03, -d / 2 + 0.05]}
          to={[left + 0.38, 0.03, -d / 2 + 0.05]}
          at={[left - 0.46, 0.34, front + 0.25]}
          label="плинтус"
          value={fields.skirting}
          placeholder="0"
          onChange={set('skirting')}
          onTyping={setTyping}
        />
        <Mark
          from={lowLeft}
          to={highRight}
          at={spot(lowLeft, highRight, 0.32, [0.16, -0.12, 0.36])}
          label="диагональ 1"
          quiet
          value={fields.diagonalA}
          onChange={set('diagonalA')}
          onTyping={setTyping}
        />
        <Mark
          from={lowRight}
          to={highLeft}
          at={spot(lowRight, highLeft, 0.72, [-0.18, 0.22, 0.28])}
          label="диагональ 2"
          quiet
          value={fields.diagonalB}
          onChange={set('diagonalB')}
          onTyping={setTyping}
        />
        <Fit w={w} h={h} d={d} />
        <OrbitControls
          makeDefault
          enabled={!typing}
          target={[0, h * 0.45, 0]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={1}
          maxDistance={12}
          enableDamping
        />
      </Canvas>
      <p className="stage-note">Ткни стрелку или поле и впиши мм</p>
    </div>
  )
}
