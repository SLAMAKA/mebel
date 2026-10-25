import { cncJobs, type MillJob } from './jobs'
import type { Polyline } from './paths'

function pair(code: number, value: string | number) {
  return `${code}\n${value}\n`
}

function layer(name: string, color: number) {
  return (
    pair(0, 'LAYER') +
    pair(2, name) +
    pair(70, 0) +
    pair(62, color) +
    pair(6, 'CONTINUOUS')
  )
}

function dxfLine(layerName: string, x1: number, y1: number, x2: number, y2: number) {
  return (
    pair(0, 'LINE') +
    pair(8, layerName) +
    pair(10, x1) +
    pair(20, y1) +
    pair(30, 0) +
    pair(11, x2) +
    pair(21, y2) +
    pair(31, 0)
  )
}

function dxfText(layerName: string, x: number, y: number, height: number, text: string) {
  const clean = text.replace(/\n/g, ' ').slice(0, 250)
  return (
    pair(0, 'TEXT') +
    pair(8, layerName) +
    pair(10, x) +
    pair(20, y) +
    pair(30, 0) +
    pair(40, height) +
    pair(1, clean)
  )
}

function polylineLines(layerName: string, line: Polyline, ox: number, oy: number) {
  const pts = line.points
  if (pts.length < 2) return ''
  const chunks: string[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    chunks.push(dxfLine(layerName, pts[i][0] + ox, pts[i][1] + oy, pts[i + 1][0] + ox, pts[i + 1][1] + oy))
  }
  if (line.closed) {
    const last = pts[pts.length - 1]
    const first = pts[0]
    chunks.push(dxfLine(layerName, last[0] + ox, last[1] + oy, first[0] + ox, first[1] + oy))
  }
  return chunks.join('')
}

function contour(ox: number, oy: number, width: number, height: number) {
  return (
    dxfLine('CONTOUR', ox, oy, ox + width, oy) +
    dxfLine('CONTOUR', ox + width, oy, ox + width, oy + height) +
    dxfLine('CONTOUR', ox + width, oy + height, ox, oy + height) +
    dxfLine('CONTOUR', ox, oy + height, ox, oy)
  )
}

export function millDxf(jobs: MillJob[]) {
  const rows = cncJobs(jobs)
  const gap = 80
  const bodies: string[] = []
  let y = 0
  for (const job of rows) {
    const layerName = job.apply === 'cut' ? 'CUT' : 'POCKET'
    bodies.push(contour(0, y, job.width, job.height))
    for (const line of job.paths) {
      bodies.push(polylineLines(layerName, line, 0, y))
    }
    const how = job.apply === 'cut' ? 'насквозь' : `глубина ${job.depth} мм`
    bodies.push(
      dxfText(
        'NOTE',
        8,
        y + job.height + 14,
        12,
        `${job.name} ${job.width}x${job.height}x${job.thick} ${how}`,
      ),
    )
    y += job.height + gap
  }

  return (
    pair(0, 'SECTION') +
    pair(2, 'HEADER') +
    pair(9, '$INSUNITS') +
    pair(70, 4) +
    pair(0, 'ENDSEC') +
    pair(0, 'SECTION') +
    pair(2, 'TABLES') +
    pair(0, 'TABLE') +
    pair(2, 'LAYER') +
    pair(70, 4) +
    layer('CONTOUR', 7) +
    layer('POCKET', 1) +
    layer('CUT', 5) +
    layer('NOTE', 3) +
    pair(0, 'ENDTAB') +
    pair(0, 'ENDSEC') +
    pair(0, 'SECTION') +
    pair(2, 'ENTITIES') +
    bodies.join('') +
    pair(0, 'ENDSEC') +
    pair(0, 'EOF')
  )
}

export function saveMillDxf(jobs: MillJob[]) {
  const text = millDxf(jobs)
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/dxf' }))
  link.download = 'frezerovka.dxf'
  link.click()
  URL.revokeObjectURL(link.href)
}
