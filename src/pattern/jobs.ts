import { handlePlan, type HandleSlot, type MarkRow, type Part } from '../geometry'
import type { HandleId, HandlePosId, HandleSideId } from '../model'
import {
  applyName,
  frameInsetMm,
  patternName,
  prunePatterns,
  type PatternApply,
  type PatternAssign,
  type PatternId,
} from './catalog'
import { clipPathsToRect, makeRippleRings, patternPaths, punchRectFromPaths, shiftPaths, type Polyline } from './paths'

export type MillJob = {
  partKey: string
  name: string
  width: number
  height: number
  thick: number
  depth: number
  margin: number
  step: number
  apply: PatternApply
  id: Exclude<PatternId, 'none'>
  paths: Polyline[]
  slot?: { x: number; y: number; w: number; h: number }
}

function faceMm(part: Part) {
  return {
    width: Math.round(part.size[0] * 1000),
    height: Math.round(part.size[1] * 1000),
    thick: Math.round(part.size[2] * 1000),
  }
}

function hasMirror(part: Part) {
  return Boolean(part.mirror && part.mirror !== 'none')
}

function faceRect(part: Part) {
  const size = faceMm(part)
  return {
    part,
    x: Math.round((part.pos[0] - part.size[0] / 2) * 1000),
    y: Math.round((part.pos[1] - part.size[1] / 2) * 1000),
    w: size.width,
    h: size.height,
    thick: size.thick,
  }
}

function slotMm(slot: HandleSlot) {
  return {
    x: slot.x * 1000 - slot.w * 500,
    y: slot.y * 1000 - slot.h * 500,
    w: slot.w * 1000,
    h: slot.h * 1000,
  }
}

function punchSlot(paths: Polyline[], slot?: HandleSlot) {
  if (!slot) return paths
  const box = slotMm(slot)
  const pad = 8
  return punchRectFromPaths(paths, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2)
}

export function millSlots(
  parts: Part[],
  handle: HandleId,
  pos: HandlePosId = 'middle',
  side: HandleSideId = 'open',
) {
  const slots = new Map<string, HandleSlot>()
  if (handle !== 'cut') return slots
  for (const part of parts) {
    if (part.role !== 'facade' || part.ghost) continue
    const plan = handlePlan(part, handle, pos, side)
    if (plan.slot) slots.set(part.key, plan.slot)
  }
  return slots
}

function jobOf(
  part: Part,
  row: PatternAssign,
  frame: string,
  label: (part: Part) => string,
  paths: Polyline[],
  slot?: HandleSlot,
): MillJob | null {
  const punched = punchSlot(paths, slot)
  if (!punched.length || row.id === 'none') return null
  const size = faceMm(part)
  const minMargin = frameInsetMm(frame)
  const margin = Math.max(row.margin, minMargin)
  const apply = row.apply ?? 'mill'
  const depth = apply === 'cut'
    ? size.thick
    : apply === 'surface'
      ? 0
      : Math.min(row.depth, Math.max(1, size.thick - 4))
  return {
    partKey: part.key,
    name: label(part),
    width: size.width,
    height: size.height,
    thick: size.thick,
    depth,
    margin,
    step: row.step,
    apply,
    id: row.id,
    paths: punched,
    slot: slot ? slotMm(slot) : undefined,
  }
}

function rippleJobs(
  facades: Part[],
  rows: PatternAssign[],
  frame: string,
  label: (part: Part) => string,
  slots: ReadonlyMap<string, HandleSlot>,
): MillJob[] {
  const jobs: MillJob[] = []
  const groups = new Map<string, PatternAssign[]>()
  for (const row of rows) {
    const key = `${row.step}-${row.margin}-${row.depth}-${row.apply}`
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  for (const pack of groups.values()) {
    const sample = pack[0]
    const minMargin = frameInsetMm(frame)
    const margin = Math.max(sample.margin, minMargin)
    const members = pack
      .map((row) => facades.find((part) => part.key === row.partKey))
      .filter((part): part is Part => {
        if (!part) return false
        return !hasMirror(part)
      })
    if (!members.length) continue
    const rects = members.map(faceRect)
    const minX = Math.min(...rects.map((item) => item.x))
    const minY = Math.min(...rects.map((item) => item.y))
    const maxX = Math.max(...rects.map((item) => item.x + item.w))
    const maxY = Math.max(...rects.map((item) => item.y + item.h))
    const rings = makeRippleRings(maxX - minX, maxY - minY, sample.step)
    for (const rect of rects) {
      const ox = rect.x - minX
      const oy = rect.y - minY
      const clipped = clipPathsToRect(rings, ox + margin, oy + margin, rect.w - margin * 2, rect.h - margin * 2)
      const local = shiftPaths(clipped, -ox, -oy)
      const row = pack.find((item) => item.partKey === rect.part.key) ?? sample
      const job = jobOf(rect.part, { ...row, id: 'ripples' }, frame, label, local, slots.get(rect.part.key))
      if (job) jobs.push(job)
    }
  }
  return jobs
}

export function millJobs(
  parts: Part[],
  patterns: PatternAssign[] | undefined,
  frame: string,
  label: (part: Part) => string,
  slots: ReadonlyMap<string, HandleSlot> = new Map(),
): MillJob[] {
  const facades = parts.filter((part) => part.role === 'facade' && !part.ghost)
  const keys = facades.map((part) => part.key)
  const live = prunePatterns(patterns ?? [], keys)
  const jobs: MillJob[] = []
  const ripples: PatternAssign[] = []
  for (const row of live) {
    const part = facades.find((item) => item.key === row.partKey)
    if (!part || hasMirror(part) || row.id === 'none') continue
    if (row.id === 'ripples') {
      ripples.push(row)
      continue
    }
    const size = faceMm(part)
    const minMargin = frameInsetMm(frame)
    const margin = Math.max(row.margin, minMargin)
    const paths = patternPaths(row.id, size.width, size.height, margin, row.step)
    const job = jobOf(part, row, frame, label, paths, slots.get(part.key))
    if (job) jobs.push(job)
  }
  jobs.push(...rippleJobs(facades, ripples, frame, label, slots))
  return jobs
}

export function cncJobs(jobs: MillJob[]) {
  return jobs.filter((job) => job.apply !== 'surface')
}

export function millMarks(jobs: MillJob[]): MarkRow[] {
  return jobs.map((job) => {
    if (job.apply === 'surface') {
      return {
        title: `${job.name} · узор`,
        text: `${patternName(job.id)} · ${applyName('surface')} · без фрезеровки`,
      }
    }
    if (job.apply === 'cut') {
      return {
        title: `${job.name} · вырез ЧПУ`,
        text: `${patternName(job.id)} · насквозь ${job.thick} мм · отступ ${job.margin} · шаг ${job.step}`,
      }
    }
    return {
      title: `${job.name} · узор`,
      text: `${patternName(job.id)} · выборка ${job.depth} мм · отступ ${job.margin} · шаг ${job.step}`,
    }
  })
}

export function jobFor(jobs: MillJob[], partKey: string) {
  return jobs.find((job) => job.partKey === partKey) ?? null
}
