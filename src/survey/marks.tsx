import { useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { DoubleSide, Quaternion, Vector3 } from 'three'
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

function Bar({ from, to, onPick }: { from: Vec; to: Vec; onPick: () => void }) {
  const start = new Vector3(...from)
  const end = new Vector3(...to)
  const delta = end.clone().sub(start)
  const span = delta.length()
  const dir = span > 0.001 ? delta.multiplyScalar(1 / span) : new Vector3(1, 0, 0)
  const head = Math.min(0.13, Math.max(span * 0.12, 0.045))
  const pull = Math.min(0.34, span * 0.22)
  const center = start.clone().lerp(end, 0.5)
  const shaftTurn = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), dir)
  const forward = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir)
  const back = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().negate())
  const tip = end.clone().addScaledVector(dir, -(pull + head / 2))
  const tail = start.clone().addScaledVector(dir, pull + head / 2)

  function pick(event: { stopPropagation: () => void }) {
    event.stopPropagation()
    onPick()
  }

  return (
    <group>
      <mesh position={center} quaternion={shaftTurn} onClick={pick}>
        <boxGeometry args={[Math.max(span, 0.02), 0.01, 0.01]} />
        <meshBasicMaterial color="#6d5848" />
      </mesh>
      <mesh position={tip} quaternion={forward} onClick={pick}>
        <coneGeometry args={[head * 0.28, head, 8]} />
        <meshBasicMaterial color="#6d5848" />
      </mesh>
      <mesh position={tail} quaternion={back} onClick={pick}>
        <coneGeometry args={[head * 0.28, head, 8]} />
        <meshBasicMaterial color="#6d5848" />
      </mesh>
    </group>
  )
}

function Mark({
  from,
  to,
  label,
  value,
  placeholder,
  at,
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
  autoFocus?: boolean
  onChange: (value: string) => void
  onTyping: (value: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <group>
      <Bar from={from} to={to} onPick={() => input.current?.focus()} />
      <Html position={at ?? spot(from, to, 0.5, [0, 0, 0])} center zIndexRange={[20, 0]}>
        <label
          className="dim-edit"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span>{label}</span>
          <input
            ref={input}
            inputMode="decimal"
            value={value}
            placeholder={placeholder ?? 'мм'}
            autoFocus={autoFocus}
            onFocus={() => window.setTimeout(() => onTyping(true), 0)}
            onBlur={() => window.setTimeout(() => onTyping(false), 0)}
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
  const left = -w / 2
  const right = w / 2
  const floor: Vec = [left, 0.05, front]
  const floorEnd: Vec = [right, 0.05, front]
  const ceil: Vec = [left, h - 0.05, front]
  const ceilEnd: Vec = [right, h - 0.05, front]
  const lowLeft: Vec = [left, 0.08, front + 0.03]
  const highRight: Vec = [right, h - 0.08, front + 0.03]
  const lowRight: Vec = [right, 0.08, front + 0.03]
  const highLeft: Vec = [left, h - 0.08, front + 0.03]

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
          from={[left, h / 2, front]}
          to={[right, h / 2, front]}
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
          from={[left - 0.05, 0.02, front]}
          to={[left - 0.05, h, front]}
          at={[left - 0.08, h * 0.58, front + 0.55]}
          label="слева"
          value={fields.heightLeft}
          onChange={set('heightLeft')}
          onTyping={setTyping}
        />
        <Mark
          from={[right + 0.05, 0.02, front]}
          to={[right + 0.05, h, front]}
          at={[right + 0.12, h * 0.58, front + 0.55]}
          label="справа"
          value={fields.heightRight}
          onChange={set('heightRight')}
          onTyping={setTyping}
        />
        <Mark
          from={[right + 0.1, 0.14, -d / 2]}
          to={[right + 0.1, 0.14, d / 2]}
          at={[right + 0.22, 0.22, 0.02]}
          label="глубина"
          value={fields.depth}
          onChange={set('depth')}
          onTyping={setTyping}
        />
        <Mark
          from={[left + 0.08, 0.03, -d / 2 + 0.05]}
          to={[left + 0.38, 0.03, -d / 2 + 0.05]}
          at={[left - 0.08, 0.2, front + 0.08]}
          label="плинтус"
          value={fields.skirting}
          placeholder="0"
          onChange={set('skirting')}
          onTyping={setTyping}
        />
        <Mark
          from={lowLeft}
          to={highRight}
          at={spot(lowLeft, highRight, 0.38, [0.08, 0, 0.48])}
          label="диагональ 1"
          value={fields.diagonalA}
          onChange={set('diagonalA')}
          onTyping={setTyping}
        />
        <Mark
          from={lowRight}
          to={highLeft}
          at={spot(lowRight, highLeft, 0.84, [-0.06, 0.02, 0.4])}
          label="диагональ 2"
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
      <p className="stage-note">Ткни линию или подпись и впиши мм</p>
    </div>
  )
}
