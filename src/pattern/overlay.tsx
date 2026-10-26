import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { MillJob } from './jobs'

const texCache = new Map<string, CanvasTexture>()

function textureKey(job: MillJob) {
  const slot = job.slot
  return `${job.partKey}-${job.id}-${job.apply}-${job.width}-${job.height}-${job.margin}-${job.step}-${job.paths.length}-${slot ? `${slot.x}-${slot.y}-${slot.w}-${slot.h}` : '0'}`
}

function makeTexture(job: MillJob) {
  const key = textureKey(job)
  const cached = texCache.get(key)
  if (cached) return cached

  const long = Math.max(job.width, job.height)
  const cap = job.id === 'ripples' ? 1536 : 1024
  const scale = Math.min(2, cap / Math.max(long, 1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(64, Math.round(job.width * scale))
  canvas.height = Math.max(64, Math.round(job.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const apply = job.apply ?? 'mill'
  const strokeMm = apply === 'cut' ? 8 : job.id === 'ripples' ? 2.2 : apply === 'surface' ? 5 : 6
  const stroke = Math.max(1.2, strokeMm * scale)
  ctx.strokeStyle = apply === 'cut'
    ? 'rgba(20, 17, 14, 0.94)'
    : apply === 'surface'
      ? 'rgba(48, 32, 22, 0.38)'
      : job.id === 'ripples' ? 'rgba(48, 32, 22, 0.82)' : 'rgba(36, 22, 14, 0.72)'
  ctx.fillStyle = apply === 'cut' ? 'rgba(20, 17, 14, 0.92)' : 'rgba(36, 22, 14, 0.18)'
  ctx.lineWidth = stroke
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const sx = canvas.width / job.width
  const sy = canvas.height / job.height
  const toX = (x: number) => x * sx
  const toY = (y: number) => canvas.height - y * sy

  for (const line of job.paths) {
    if (line.points.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(toX(line.points[0][0]), toY(line.points[0][1]))
    for (let i = 1; i < line.points.length; i++) {
      ctx.lineTo(toX(line.points[i][0]), toY(line.points[i][1]))
    }
    if (line.closed) ctx.closePath()
    if (line.closed && apply !== 'mill') ctx.fill()
    ctx.stroke()
  }

  if (job.slot) {
    const pad = 8
    const r = Math.min(job.slot.h, job.slot.w) / 2
    const x = toX(job.slot.x - pad)
    const y = toY(job.slot.y + job.slot.h + pad)
    const w = (job.slot.w + pad * 2) * sx
    const h = (job.slot.h + pad * 2) * sy
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, (r + pad) * scale)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  texCache.set(key, tex)
  return tex
}

export function PatternOverlay({
  size,
  meshX,
  job,
}: {
  size: [number, number, number]
  meshX: number
  job: MillJob | null
}) {
  const tex = useMemo(() => (job ? makeTexture(job) : undefined), [job])
  if (!job || !tex) return null
  const z = size[2] / 2 + 0.0006
  return (
    <mesh position={[meshX, 0, z]}>
      <planeGeometry args={[size[0], size[1]]} />
      <meshBasicMaterial map={tex} transparent polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  )
}
