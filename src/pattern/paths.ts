import type { PatternId } from './catalog'

export type Polyline = {
  points: [number, number][]
  closed?: boolean
}

function snap(value: number) {
  return Math.round(value * 10) / 10
}

function point(x: number, y: number): [number, number] {
  return [snap(x), snap(y)]
}

function flutesV(width: number, height: number, margin: number, step: number): Polyline[] {
  const y0 = margin
  const y1 = height - margin
  if (y1 - y0 < 8) return []
  const paths: Polyline[] = []
  for (let x = margin; x <= width - margin + 0.05; x += step) {
    paths.push({ points: [point(x, y0), point(x, y1)] })
  }
  const last = width - margin
  const tail = paths[paths.length - 1]
  if (tail && Math.abs(tail.points[0][0] - last) > 1) {
    paths.push({ points: [point(last, y0), point(last, y1)] })
  }
  return paths
}

function flutesH(width: number, height: number, margin: number, step: number): Polyline[] {
  const x0 = margin
  const x1 = width - margin
  if (x1 - x0 < 8) return []
  const paths: Polyline[] = []
  for (let y = margin; y <= height - margin + 0.05; y += step) {
    paths.push({ points: [point(x0, y), point(x1, y)] })
  }
  const last = height - margin
  const tail = paths[paths.length - 1]
  if (tail && Math.abs(tail.points[0][1] - last) > 1) {
    paths.push({ points: [point(x0, last), point(x1, last)] })
  }
  return paths
}

function diamonds(width: number, height: number, margin: number, step: number): Polyline[] {
  const size = Math.max(10, step * 0.4)
  const pitch = Math.max(step, size * 2 + 4)
  const paths: Polyline[] = []
  let row = 0
  for (let y = margin + size; y <= height - margin - size + 0.05; y += pitch) {
    const x0 = margin + size + (row % 2) * (pitch / 2)
    for (let x = x0; x <= width - margin - size + 0.05; x += pitch) {
      paths.push({
        closed: true,
        points: [
          point(x, y + size),
          point(x + size, y),
          point(x, y - size),
          point(x - size, y),
        ],
      })
    }
    row += 1
  }
  return paths
}

function chevron(width: number, height: number, margin: number, step: number): Polyline[] {
  const zig = Math.max(16, step)
  const amp = Math.min(step * 0.42, (height - 2 * margin) / 3)
  if (amp < 4) return []
  const paths: Polyline[] = []
  for (let y = margin + amp; y <= height - margin - amp + 0.05; y += step) {
    const pts: [number, number][] = []
    let up = true
    for (let x = margin; x <= width - margin + 0.05; x += zig) {
      pts.push(point(x, up ? y + amp : y - amp))
      up = !up
    }
    const lastX = width - margin
    if (!pts.length || Math.abs(pts[pts.length - 1][0] - lastX) > 1) {
      pts.push(point(lastX, up ? y + amp : y - amp))
    }
    if (pts.length >= 2) paths.push({ points: pts })
  }
  return paths
}

function waves(width: number, height: number, margin: number, step: number): Polyline[] {
  const amp = Math.min(step * 0.32, (height - 2 * margin) / 4)
  if (amp < 3) return []
  const sample = 8
  const paths: Polyline[] = []
  const span = Math.max(1, width - 2 * margin)
  for (let y = margin + amp; y <= height - margin - amp + 0.05; y += step) {
    const pts: [number, number][] = []
    for (let x = margin; x <= width - margin + 0.05; x += sample) {
      const t = ((x - margin) / span) * Math.PI * (span / Math.max(step, 1))
      pts.push(point(x, y + Math.sin(t) * amp))
    }
    const lastX = width - margin
    if (!pts.length || Math.abs(pts[pts.length - 1][0] - lastX) > 1) {
      const t = Math.PI * (span / Math.max(step, 1))
      pts.push(point(lastX, y + Math.sin(t) * amp))
    }
    if (pts.length >= 2) paths.push({ points: pts })
  }
  return paths
}

type Rect = { x0: number; y0: number; x1: number; y1: number }

function inRect(p: [number, number], rect: Rect) {
  return p[0] >= rect.x0 && p[0] <= rect.x1 && p[1] >= rect.y0 && p[1] <= rect.y1
}

function hitEdge(inside: [number, number], outside: [number, number], rect: Rect): [number, number] {
  const dx = outside[0] - inside[0]
  const dy = outside[1] - inside[1]
  let t = 1
  if (dx < 0) t = Math.min(t, (rect.x0 - inside[0]) / dx)
  if (dx > 0) t = Math.min(t, (rect.x1 - inside[0]) / dx)
  if (dy < 0) t = Math.min(t, (rect.y0 - inside[1]) / dy)
  if (dy > 0) t = Math.min(t, (rect.y1 - inside[1]) / dy)
  if (!Number.isFinite(t)) t = 0
  t = Math.max(0, Math.min(1, t))
  return [inside[0] + dx * t, inside[1] + dy * t]
}

function clipClosedToRect(points: [number, number][], rect: Rect): Polyline[] {
  if (points.length < 3) return []
  if (points.every((p) => inRect(p, rect))) {
    return [{ points: points.map((p) => point(p[0], p[1])), closed: true }]
  }
  const ring = [...points, points[0]]
  const chunks: [number, number][][] = []
  let acc: [number, number][] = []
  function flush() {
    if (acc.length >= 2) chunks.push(acc)
    acc = []
  }
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]
    const b = ring[i + 1]
    const ia = inRect(a, rect)
    const ib = inRect(b, rect)
    if (ia && ib) {
      if (!acc.length) acc.push(a)
      acc.push(b)
    } else if (ia && !ib) {
      if (!acc.length) acc.push(a)
      acc.push(hitEdge(a, b, rect))
      flush()
    } else if (!ia && ib) {
      acc.push(hitEdge(b, a, rect))
      acc.push(b)
    }
  }
  if (acc.length && chunks.length && inRect(points[0], rect)) {
    chunks[0] = [...acc, ...chunks[0]]
    acc = []
  }
  flush()
  return chunks.map((pts) => ({ points: pts.map((p) => point(p[0], p[1])) }))
}

export function clipPathsToRect(paths: Polyline[], x: number, y: number, w: number, h: number): Polyline[] {
  if (w < 8 || h < 8) return []
  const rect = { x0: x, y0: y, x1: x + w, y1: y + h }
  const out: Polyline[] = []
  for (const line of paths) {
    out.push(...clipClosedToRect(line.points, rect))
  }
  return out
}

function clipOutsideRect(points: [number, number][], hole: Rect, closed?: boolean): Polyline[] {
  if (points.length < 2) return []
  if (points.every((p) => !inRect(p, hole))) {
    return [{ points: points.map((p) => point(p[0], p[1])), closed }]
  }
  if (points.every((p) => inRect(p, hole))) return []
  const chain = closed ? [...points, points[0]] : points
  const chunks: [number, number][][] = []
  let acc: [number, number][] = []
  function flush() {
    if (acc.length >= 2) chunks.push(acc)
    acc = []
  }
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i]
    const b = chain[i + 1]
    const oa = !inRect(a, hole)
    const ob = !inRect(b, hole)
    if (oa && ob) {
      if (!acc.length) acc.push(a)
      acc.push(b)
    } else if (oa && !ob) {
      if (!acc.length) acc.push(a)
      acc.push(hitEdge(a, b, hole))
      flush()
    } else if (!oa && ob) {
      acc.push(hitEdge(b, a, hole))
      acc.push(b)
    }
  }
  flush()
  return chunks.map((pts) => ({ points: pts.map((p) => point(p[0], p[1])) }))
}

/** Убирает куски путей внутри прямоугольника. Для обхода ручки-выреза. */
export function punchRectFromPaths(paths: Polyline[], x: number, y: number, w: number, h: number): Polyline[] {
  if (w < 2 || h < 2) return paths
  const hole = { x0: x, y0: y, x1: x + w, y1: y + h }
  const out: Polyline[] = []
  for (const line of paths) {
    out.push(...clipOutsideRect(line.points, hole, line.closed))
  }
  return out
}

export function shiftPaths(paths: Polyline[], dx: number, dy: number): Polyline[] {
  return paths.map((line) => ({
    ...line,
    points: line.points.map((p) => point(p[0] + dx, p[1] + dy)),
  }))
}

function circleRing(cx: number, cy: number, r: number): Polyline {
  const n = Math.max(24, Math.min(96, Math.round((2 * Math.PI * r) / 10)))
  const points: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    points.push(point(cx + Math.cos(a) * r, cy + Math.sin(a) * r))
  }
  return { points, closed: true }
}

function rippleCenters(width: number, height: number) {
  return [
    { x: width * 0.16, y: height * 0.20 },
    { x: width * 0.58, y: height * 0.28 },
    { x: width * 0.90, y: height * 0.16 },
    { x: width * 0.08, y: height * 0.52 },
    { x: width * 0.40, y: height * 0.58 },
    { x: width * 0.78, y: height * 0.62 },
    { x: width * 0.26, y: height * 0.88 },
    { x: width * 0.68, y: height * 0.90 },
    { x: width * 0.96, y: height * 0.78 },
  ]
}

/** Концентрические кольца на весь щит. Круги выходят за край. */
export function makeRippleRings(width: number, height: number, step: number): Polyline[] {
  const pitch = Math.max(12, step)
  const paths: Polyline[] = []
  for (const center of rippleCenters(width, height)) {
    const reach = Math.max(
      Math.hypot(center.x, center.y),
      Math.hypot(width - center.x, center.y),
      Math.hypot(center.x, height - center.y),
      Math.hypot(width - center.x, height - center.y),
    )
    for (let r = pitch; r <= reach + 0.05; r += pitch) {
      paths.push(circleRing(center.x, center.y, r))
    }
  }
  return paths
}

function ripples(width: number, height: number, margin: number, step: number): Polyline[] {
  const pad = Math.max(0, margin)
  const rings = makeRippleRings(width, height, step)
  return clipPathsToRect(rings, pad, pad, width - pad * 2, height - pad * 2)
}

function circles(width: number, height: number, margin: number, step: number): Polyline[] {
  const r = Math.max(6, step * 0.28)
  const pitch = Math.max(step, r * 2 + 8)
  const paths: Polyline[] = []
  let row = 0
  for (let y = margin + r; y <= height - margin - r + 0.05; y += pitch) {
    const x0 = margin + r + (row % 2) * (pitch / 2)
    for (let x = x0; x <= width - margin - r + 0.05; x += pitch) {
      const pts: [number, number][] = []
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        pts.push(point(x + Math.cos(a) * r, y + Math.sin(a) * r))
      }
      paths.push({ points: pts, closed: true })
    }
    row += 1
  }
  return paths
}

/** Пути выборки в мм. Начало — левый нижний угол лица щита. */
export function patternPaths(
  id: PatternId,
  width: number,
  height: number,
  margin: number,
  step: number,
): Polyline[] {
  if (id === 'none') return []
  const pad = Math.max(0, margin)
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  if (innerW < 12 || innerH < 12) return []
  const pitch = Math.max(12, step)
  if (id === 'flutes-v') return flutesV(width, height, pad, pitch)
  if (id === 'flutes-h') return flutesH(width, height, pad, pitch)
  if (id === 'grid') return [...flutesV(width, height, pad, pitch), ...flutesH(width, height, pad, pitch)]
  if (id === 'diamonds') return diamonds(width, height, pad, pitch)
  if (id === 'chevron') return chevron(width, height, pad, pitch)
  if (id === 'waves') return waves(width, height, pad, pitch)
  if (id === 'circles') return circles(width, height, pad, pitch)
  if (id === 'ripples') return ripples(width, height, pad, pitch)
  return []
}
