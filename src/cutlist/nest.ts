import type { CutRow } from '../geometry'

/** Стандартный лист ЛДСП, мм. */
export const SHEET_L = 2800
export const SHEET_W = 2070
/** Пропил / зазор между деталями, мм. */
export const KERF_MM = 4

export type NestPiece = {
  id: string
  name: string
  material: string
  w: number
  h: number
  thick: number
  rotated: boolean
}

export type NestPlacement = NestPiece & {
  x: number
  y: number
  sheet: number
}

export type NestSheet = {
  index: number
  material: string
  thick: number
  usedArea: number
  util: number
  placements: NestPlacement[]
}

export type NestResult = {
  sheetL: number
  sheetW: number
  kerf: number
  sheets: NestSheet[]
  sheetCount: number
  utilAvg: number
}

type FreeRect = { x: number; y: number; w: number; h: number }

function expandCuts(cuts: CutRow[]): NestPiece[] {
  const pieces: NestPiece[] = []
  for (const row of cuts) {
    // ХДФ и тонкие задники — отдельный лист по толщине.
    for (let i = 0; i < row.qty; i++) {
      pieces.push({
        id: `${row.name}-${row.thick}-${i}`,
        name: row.name,
        material: row.material,
        w: row.length,
        h: row.width,
        thick: row.thick,
        rotated: false,
      })
    }
  }
  // Крупные сначала — лучше утилизация.
  pieces.sort((a, b) => b.w * b.h - a.w * a.h)
  return pieces
}

function fits(rect: FreeRect, w: number, h: number, kerf: number) {
  return w + kerf <= rect.w + 0.001 && h + kerf <= rect.h + 0.001
}

function splitFree(free: FreeRect[], used: FreeRect, kerf: number): FreeRect[] {
  const next: FreeRect[] = []
  for (const rect of free) {
    const noOverlap =
      used.x >= rect.x + rect.w ||
      used.x + used.w <= rect.x ||
      used.y >= rect.y + rect.h ||
      used.y + used.h <= rect.y
    if (noOverlap) {
      next.push(rect)
      continue
    }
    // MaxRects: режем свободный прямоугольник вокруг занятого.
    if (used.x > rect.x + 0.001) {
      next.push({ x: rect.x, y: rect.y, w: used.x - rect.x, h: rect.h })
    }
    if (used.x + used.w + kerf < rect.x + rect.w - 0.001) {
      next.push({
        x: used.x + used.w + kerf,
        y: rect.y,
        w: rect.x + rect.w - (used.x + used.w + kerf),
        h: rect.h,
      })
    }
    if (used.y > rect.y + 0.001) {
      next.push({ x: rect.x, y: rect.y, w: rect.w, h: used.y - rect.y })
    }
    if (used.y + used.h + kerf < rect.y + rect.h - 0.001) {
      next.push({
        x: rect.x,
        y: used.y + used.h + kerf,
        w: rect.w,
        h: rect.y + rect.h - (used.y + used.h + kerf),
      })
    }
  }
  return pruneFree(next)
}

function pruneFree(rects: FreeRect[]) {
  const kept: FreeRect[] = []
  for (let i = 0; i < rects.length; i++) {
    const a = rects[i]
    if (a.w < 1 || a.h < 1) continue
    let inside = false
    for (let j = 0; j < rects.length; j++) {
      if (i === j) continue
      const b = rects[j]
      if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
        inside = true
        break
      }
    }
    if (!inside) kept.push(a)
  }
  return kept
}

function placeOnSheet(
  free: FreeRect[],
  piece: NestPiece,
  kerf: number,
  allowRotate: boolean,
): { free: FreeRect[]; placement: Omit<NestPlacement, 'sheet'> } | null {
  type Cand = { score: number; x: number; y: number; w: number; h: number; rotated: boolean; idx: number }
  let best: Cand | null = null

  const variants = allowRotate
    ? [
        { w: piece.w, h: piece.h, rotated: false },
        { w: piece.h, h: piece.w, rotated: true },
      ]
    : [{ w: piece.w, h: piece.h, rotated: false }]

  for (let i = 0; i < free.length; i++) {
    const rect = free[i]
    for (const v of variants) {
      if (!fits(rect, v.w, v.h, kerf)) continue
      const leftover = rect.w * rect.h - (v.w + kerf) * (v.h + kerf)
      const score = leftover
      if (!best || score < best.score || (score === best.score && rect.y < best.y)) {
        best = { score, x: rect.x, y: rect.y, w: v.w, h: v.h, rotated: v.rotated, idx: i }
      }
    }
  }
  if (!best) return null

  const used: FreeRect = { x: best.x, y: best.y, w: best.w + kerf, h: best.h + kerf }
  return {
    free: splitFree(free, used, kerf),
    placement: {
      ...piece,
      w: best.w,
      h: best.h,
      rotated: best.rotated,
      x: best.x,
      y: best.y,
    },
  }
}

/**
 * MaxRects (BSSF) по мотивам open-source cut-list пакеров.
 * Прямоугольники, поворот 90° разрешён (кроме явного запрета позже).
 */
export function nestCuts(
  cuts: CutRow[],
  opts?: { sheetL?: number; sheetW?: number; kerf?: number; allowRotate?: boolean },
): NestResult {
  const sheetL = opts?.sheetL ?? SHEET_L
  const sheetW = opts?.sheetW ?? SHEET_W
  const kerf = opts?.kerf ?? KERF_MM
  const allowRotate = opts?.allowRotate ?? true
  const sheetArea = sheetL * sheetW

  // Группы по материалу+толщине — разные листы.
  const groups = new Map<string, NestPiece[]>()
  for (const piece of expandCuts(cuts)) {
    const key = `${piece.material}|${piece.thick}`
    const list = groups.get(key) ?? []
    list.push(piece)
    groups.set(key, list)
  }

  const sheets: NestSheet[] = []

  for (const [, group] of groups) {
    let free: FreeRect[] = [{ x: 0, y: 0, w: sheetL, h: sheetW }]
    let placements: NestPlacement[] = []
    let sheetIndex = sheets.length
    let usedArea = 0

    const flush = () => {
      if (placements.length === 0) return
      sheets.push({
        index: sheetIndex,
        material: group[0].material,
        thick: group[0].thick,
        usedArea,
        util: usedArea / sheetArea,
        placements,
      })
    }

    for (const piece of group) {
      if (piece.w > sheetL && piece.h > sheetL) continue
      let placed = placeOnSheet(free, piece, kerf, allowRotate)
      if (!placed) {
        flush()
        sheetIndex = sheets.length
        free = [{ x: 0, y: 0, w: sheetL, h: sheetW }]
        placements = []
        usedArea = 0
        placed = placeOnSheet(free, piece, kerf, allowRotate)
      }
      if (!placed) continue
      free = placed.free
      const full: NestPlacement = { ...placed.placement, sheet: sheetIndex }
      placements.push(full)
      usedArea += placed.placement.w * placed.placement.h
    }
    flush()
  }

  const utilAvg = sheets.length
    ? sheets.reduce((sum, sheet) => sum + sheet.util, 0) / sheets.length
    : 0

  return {
    sheetL,
    sheetW,
    kerf,
    sheets,
    sheetCount: sheets.length,
    utilAvg,
  }
}

export function nestSpecRows(nest: NestResult): { name: string; value: string }[] {
  if (!nest.sheetCount) return []
  return [
    {
      name: 'Раскрой листов',
      value: `${nest.sheetCount} шт ${nest.sheetL}×${nest.sheetW} · утилизация ${Math.round(nest.utilAvg * 100)}% · пропил ${nest.kerf} мм`,
    },
  ]
}
