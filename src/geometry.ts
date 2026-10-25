import {
  findById,
  sanitize,
  bases,
  boards,
  colors,
  doorModes,
  finishes,
  frameModes,
  handles,
  mirrorModes,
  type BaseId,
  type Config,
  type HandleId,
  type HandlePosId,
  type HandleSideId,
  type MirrorId,
} from './model'
import { nestCuts, nestSpecRows, type NestResult } from './cutlist/nest'
import { millJobs, millMarks, millSlots, type MillJob } from './pattern/jobs'
import {
  BOARD_T,
  findHandleHardware,
  findHinge,
  runnerSpecLine,
} from './hardware/catalog'
import {
  drawerBoxFromOpening,
  findRunner,
  type RunnerId,
} from './drawer/sizing'
import { envelopeOf, surveyLines, type Survey } from './survey/model'

export type Role = 'carcass' | 'facade' | 'back' | 'plinth' | 'metal'
export type Move = 'swing-left' | 'swing-right' | 'slide-left' | 'slide-right' | 'drawer' | 'tilt'
export type Face = 'pz' | 'px'

export type Part = {
  key: string
  size: [number, number, number]
  pos: [number, number, number]
  role: Role
  move?: Move
  face?: Face
  mirror?: MirrorId
  /** Форма детали. По умолчанию box. */
  shape?: 'box' | 'cyl'
  /** Ось цилиндра. По умолчанию вертикаль. */
  axis?: 'x' | 'y'
  /** Наклон вокруг X в радианах. Для полок обувницы. */
  pitch?: number
  /** Деталь едет вместе с этой фасадной деталью. */
  host?: string
  /** Ход выдвижения ящика по Z, м. */
  travel?: number
  /** Только для раскроя. На сцене не рисуется. */
  ghost?: boolean
}

export type Span = { w: number; h: number; d: number }
export type SpecRow = { name: string; value: string }

export type CutRow = {
  name: string
  material: string
  length: number
  width: number
  thick: number
  qty: number
  edge: string
  sawL: number
  sawW: number
}

export type TapeRow = {
  name: string
  need: number
  order: number
}

export type MarkRow = {
  title: string
  text: string
}

export type Compiled = {
  parts: Part[]
  span: Span
  dims: Span
  spec: SpecRow[]
  cuts: CutRow[]
  tapes: TapeRow[]
  marks: MarkRow[]
  nest: NestResult
  mill: MillJob[]
}

export const PANEL_T = BOARD_T.ldsp18
const DRAWER_BOARD = BOARD_T.ldsp16
const BACK_T = BOARD_T.hdf8

export function mm(value: number) {
  return value / 1000
}

export function shell(prefix: string, x: number, yBottom: number, z: number, w: number, h: number, d: number): Part[] {
  const T = PANEL_T
  const y = yBottom + h / 2
  const innerW = Math.max(0.02, w - 2 * T)
  const innerH = Math.max(0.02, h - 2 * T)
  return [
    { key: `${prefix}-l`, size: [T, h, d], pos: [x - w / 2 + T / 2, y, z], role: 'carcass' },
    { key: `${prefix}-r`, size: [T, h, d], pos: [x + w / 2 - T / 2, y, z], role: 'carcass' },
    { key: `${prefix}-t`, size: [innerW, T, d], pos: [x, yBottom + h - T / 2, z], role: 'carcass' },
    { key: `${prefix}-b`, size: [innerW, T, d], pos: [x, yBottom + T / 2, z], role: 'carcass' },
    { key: `${prefix}-back`, size: [innerW, innerH, BACK_T], pos: [x, y, z - d / 2 + BACK_T / 2 + 0.006], role: 'back' },
  ]
}

function legs(prefix: string, x: number, z: number, w: number, d: number, h: number): Part[] {
  const spots = [
    ['lb', -1, -1],
    ['rb', 1, -1],
    ['lf', -1, 1],
    ['rf', 1, 1],
  ] as const
  return spots.map(([name, sx, sz]) => ({
    key: `${prefix}-leg-${name}`,
    size: [0.04, h, 0.04] as [number, number, number],
    pos: [x + sx * (w / 2 - 0.055), h / 2, z + sz * (d / 2 - 0.055)] as [number, number, number],
    role: 'metal' as const,
  }))
}

function plinth(prefix: string, x: number, z: number, w: number, d: number, h: number): Part[] {
  const T = PANEL_T
  return [
    { key: `${prefix}-plinth-f`, size: [w - 0.028, h, T], pos: [x, h / 2, z + d / 2 - 0.058], role: 'plinth' },
    { key: `${prefix}-plinth-l`, size: [T, h, d - 0.09], pos: [x - w / 2 + 0.02, h / 2, z - 0.02], role: 'plinth' },
    { key: `${prefix}-plinth-r`, size: [T, h, d - 0.09], pos: [x + w / 2 - 0.02, h / 2, z - 0.02], role: 'plinth' },
  ]
}

export function support(prefix: string, base: BaseId, x: number, z: number, w: number, d: number, h: number) {
  if (base === 'legs') return legs(prefix, x, z, w, d, h)
  return plinth(prefix, x, z, w, d, h)
}

function cabinetBody(config: Config, withDoors: boolean): Part[] {
  const T = PANEL_T
  const w = mm(config.width)
  const h = mm(config.height)
  const d = mm(config.depth)
  const lift = config.base === 'legs' ? 0.1 : 0.08
  const bodyH = Math.max(0.25, h - lift)
  const sections = Math.max(1, config.sections)
  const parts: Part[] = [
    ...shell('cab', 0, lift, 0, w, bodyH, d),
    ...support('cab', config.base, 0, 0, w, d, lift),
  ]

  const innerW = w - 2 * T
  const bay = (innerW - (sections - 1) * T) / sections
  const origin = -innerW / 2
  const innerH = bodyH - 2 * T
  const y0 = lift + T

  for (let i = 1; i < sections; i++) {
    const x = origin + i * bay + (i - 0.5) * T
    parts.push({
      key: `cab-div-${i}`,
      size: [T, innerH, d - 0.04],
      pos: [x, y0 + innerH / 2, -0.008],
      role: 'carcass',
    })
  }

  for (let s = 0; s < sections; s++) {
    const left = origin + s * (bay + T)
    const clear = bay
    if (clear < 0.03) continue
    for (let k = 0; k < config.shelves; k++) {
      parts.push({
        key: `cab-shelf-${s}-${k}`,
        size: [clear - 0.002, T, d - 0.09],
        pos: [left + clear / 2, y0 + ((k + 1) * innerH) / (config.shelves + 1), -0.02],
        role: 'carcass',
      })
    }
  }

  if (withDoors && config.doors !== 'open') {
    const gap = 0.003
    const doorH = bodyH - gap * 2
    const doorY = lift + bodyH / 2
    const doorZ = d / 2 + T / 2 + 0.001
    if (config.doors === 'swing') {
      const doorW = (w - gap * (sections + 1)) / sections
      for (let s = 0; s < sections; s++) {
        parts.push({
          key: `cab-door-${s}`,
          size: [doorW, doorH, T],
          pos: [-w / 2 + gap + doorW / 2 + s * (doorW + gap), doorY, doorZ],
          role: 'facade',
          move: s % 2 === 0 ? 'swing-left' : 'swing-right',
          face: 'pz',
          mirror: config.mirror,
        })
      }
    } else {
      const step = w / sections
      for (let s = 0; s < sections; s++) {
        parts.push({
          key: `cab-slide-${s}`,
          size: [step + 0.028, doorH, T],
          pos: [-w / 2 + step * s + step / 2, doorY, doorZ + (s % 2) * 0.02],
          role: 'facade',
          move: s % 2 === 0 ? 'slide-left' : 'slide-right',
          face: 'pz',
          mirror: config.mirror,
        })
      }
    }
  }

  return parts
}

function pedestal(config: Config): Part[] {
  const T = PANEL_T
  const BOARD = DRAWER_BOARD
  const w = mm(config.width)
  const h = mm(config.height)
  const d = mm(config.depth)
  const lift = config.base === 'legs' ? 0.08 : 0.06
  const bodyH = Math.max(0.2, h - lift)
  const sections = Math.max(1, config.sections)
  const drawers = Math.max(1, config.drawers)
  const runnerId = (config.runner ?? 'ball') as RunnerId
  const parts: Part[] = [
    ...shell('cab', 0, lift, 0, w, bodyH, d),
    ...support('cab', config.base, 0, 0, w, d, lift),
  ]

  const innerW = w - 2 * T
  const bay = (innerW - (sections - 1) * T) / sections
  const origin = -innerW / 2
  const innerH = bodyH - 2 * T
  const y0 = lift + T
  const innerFront = d / 2 - 0.001
  const innerBack = -d / 2 + 0.008 + 0.006
  const openingD = Math.max(0.12, innerFront - innerBack)

  for (let i = 1; i < sections; i++) {
    const x = origin + i * bay + (i - 0.5) * T
    parts.push({
      key: `cab-div-${i}`,
      size: [T, innerH, d - 0.04],
      pos: [x, y0 + innerH / 2, -0.008],
      role: 'carcass',
    })
  }

  const gap = 0.003
  const faceH = (bodyH - gap * (drawers + 1)) / drawers
  const doorZ = d / 2 + T / 2 + 0.001
  const slotH = innerH / drawers
  const runner = findRunner(runnerId)

  for (let s = 0; s < sections; s++) {
    const faceW = (w - gap * (sections + 1)) / sections
    const faceX = -w / 2 + gap + faceW / 2 + s * (faceW + gap)
    const bayLeft = origin + s * (bay + T)
    const openingW = bay

    for (let k = 0; k < drawers; k++) {
      const faceKey = `cab-drawer-${s}-${k}`
      const faceY = lift + gap + faceH / 2 + k * (faceH + gap)
      const slotBottom = y0 + k * slotH
      const box = drawerBoxFromOpening(
        { openingW, openingH: slotH, openingD },
        runnerId,
      )

      parts.push({
        key: faceKey,
        size: [faceW, faceH, T],
        pos: [faceX, faceY, doorZ],
        role: 'facade',
        move: 'drawer',
        face: 'pz',
        mirror: 'none',
        travel: box.travel,
      })

      const boxX = bayLeft + openingW / 2
      const floorY = slotBottom + box.bottomClear + BOARD / 2
      const wallH = Math.max(0.05, box.boxH - BOARD)
      const sideY = floorY + BOARD / 2 + wallH / 2
      const boxFront = innerFront - 0.004
      const boxZ = boxFront - box.boxD / 2
      const sideX = box.boxW / 2 - BOARD / 2

      // Короб ящика едет с фасадом.
      parts.push(
        {
          key: `cab-floor-${s}-${k}`,
          size: [box.boxW, BOARD, box.boxD],
          pos: [boxX, floorY, boxZ],
          role: 'carcass',
          host: faceKey,
        },
        {
          key: `cab-side-l-${s}-${k}`,
          size: [BOARD, wallH, box.boxD],
          pos: [boxX - sideX, sideY, boxZ],
          role: 'carcass',
          host: faceKey,
        },
        {
          key: `cab-side-r-${s}-${k}`,
          size: [BOARD, wallH, box.boxD],
          pos: [boxX + sideX, sideY, boxZ],
          role: 'carcass',
          host: faceKey,
        },
        {
          key: `cab-box-back-${s}-${k}`,
          size: [Math.max(0.06, box.boxW - BOARD * 2), wallH * 0.92, BOARD],
          pos: [boxX, sideY, boxZ - box.boxD / 2 + BOARD / 2],
          role: 'carcass',
          host: faceKey,
        },
      )

      // Неподвижная часть направляющей на корпусе + подвижная на ящике.
      const railY = floorY + BOARD / 2 + 0.012
      const railLen = box.runnerLen
      for (const [name, sign] of [
        ['l', -1],
        ['r', 1],
      ] as const) {
        const carcassX = boxX + sign * (openingW / 2 - runner.sideClear * 0.45)
        const boxRailX = boxX + sign * (box.boxW / 2 + 0.003)
        parts.push({
          key: `cab-rail-fixed-${name}-${s}-${k}`,
          size: [0.01, 0.018, railLen],
          pos: [carcassX, railY, boxFront - railLen / 2],
          role: 'metal',
        })
        parts.push({
          key: `cab-rail-move-${name}-${s}-${k}`,
          size: [0.008, 0.014, Math.max(0.1, railLen * 0.92)],
          pos: [boxRailX, railY, boxZ],
          role: 'metal',
          host: faceKey,
        })
      }
    }
  }

  return parts
}

function buildParts(config: Config): Part[] {
  if (config.kind === 'pedestal') return pedestal(config)
  return cabinetBody(config, true)
}

export function layout(parts: Part[]) {
  let minX = Infinity
  let maxX = -Infinity
  let maxY = 0
  let minZ = Infinity
  let maxZ = -Infinity
  for (const part of parts) {
    minX = Math.min(minX, part.pos[0] - part.size[0] / 2)
    maxX = Math.max(maxX, part.pos[0] + part.size[0] / 2)
    maxY = Math.max(maxY, part.pos[1] + part.size[1] / 2)
    minZ = Math.min(minZ, part.pos[2] - part.size[2] / 2)
    maxZ = Math.max(maxZ, part.pos[2] + part.size[2] / 2)
  }
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  return {
    parts: parts.map((part) => ({
      ...part,
      pos: [part.pos[0] - cx, part.pos[1] + 0.002, part.pos[2] - cz] as [number, number, number],
    })),
    span: { w: maxX - minX, h: maxY, d: maxZ - minZ },
  }
}

function panelArea(size: [number, number, number]) {
  const sorted = [...size].sort((a, b) => a - b)
  return sorted[1] * sorted[2]
}

export function hingeHeights(doorH: number) {
  if (doorH < 0.35) return [0]
  if (doorH < 0.9) return [-doorH * 0.32, doorH * 0.32]
  return [-doorH * 0.38, 0, doorH * 0.38]
}

function alongHeight(h: number, pos: HandlePosId) {
  if (pos === 'top') return h * 0.78
  if (pos === 'bottom') return h * 0.22
  return h * 0.5
}

export type HandleSlot = { x: number; y: number; w: number; h: number }

function cutSlot(part: Part, pos: HandlePosId, side: HandleSideId): HandleSlot {
  const w = part.size[0]
  const h = part.size[1]
  const slotH = Math.min(0.03, Math.max(0.02, h * 0.14))
  const slotW = Math.min(Math.max(0.14, w * 0.55), w - 0.036)
  const pad = 0.01 + slotH / 2
  const drawer = part.move === 'drawer' || part.move === 'tilt'
  const y = pos === 'bottom' ? pad : pos === 'top' ? h - pad : h * 0.5
  if (drawer) return { x: w * 0.5, y, w: slotW, h: slotH }
  const hingeLeft = part.move === 'swing-left' || part.move === 'slide-left' || !part.move
  const openOnLeft = !hingeLeft
  const onLeft = side === 'open' ? openOnLeft : hingeLeft
  const x = onLeft ? slotW / 2 + 0.02 : w - slotW / 2 - 0.02
  return { x, y, w: slotW, h: slotH }
}

export function handlePlan(
  part: Part,
  handle: HandleId,
  pos: HandlePosId = 'middle',
  side: HandleSideId = 'open',
) {
  const w = part.size[0]
  const h = part.size[1]
  if (handle === 'none') return { holes: [] as { x: number; y: number }[] }
  if (handle === 'cut') return { holes: [] as { x: number; y: number }[], slot: cutSlot(part, pos, side) }

  const y = alongHeight(h, pos)

  const hw = findHandleHardware(handle)
  const holeSpan = (hw.holeSpanMm ?? 128) / 1000

  // Ящик и откидной фасад: ручка по центру.
  if (part.move === 'drawer' || part.move === 'tilt') {
    if (handle === 'knob') return { holes: [{ x: w * 0.5, y }] }
    if (handle === 'edge') return { holes: [{ x: w * 0.5, y: h * 0.92 }] }
    const span = Math.min(holeSpan, Math.max(0.08, w * 0.9))
    return {
      holes: [
        { x: w * 0.5 - span / 2, y },
        { x: w * 0.5 + span / 2, y },
      ],
    }
  }

  // Петля слева → открытие справа. Петля справа → открытие слева.
  const hingeLeft = part.move === 'swing-left' || part.move === 'slide-left' || !part.move
  const openOnLeft = !hingeLeft
  const onOpen = side === 'open'
  const onLeft = onOpen ? openOnLeft : hingeLeft
  const edgeX = onLeft ? w * 0.18 : w * 0.82

  if (handle === 'knob') return { holes: [{ x: edgeX, y }] }

  if (handle === 'edge') {
    // Профиль у самого края открывания или петли.
    const flushX = onLeft ? w * 0.035 : w * 0.965
    return { holes: [{ x: flushX, y }] }
  }

  if (handle === 'bow') {
    const span = Math.min(holeSpan, Math.max(0.08, h * 0.2))
    return {
      holes: [
        { x: edgeX, y: y - span / 2 },
        { x: edgeX, y: y + span / 2 },
      ],
    }
  }

  if (handle === 'rail') {
    const span = Math.min(holeSpan, Math.max(0.12, w * 0.4))
    const cx = onLeft ? w * 0.38 : w * 0.62
    return {
      holes: [
        { x: cx - span / 2, y },
        { x: cx + span / 2, y },
      ],
    }
  }

  const span = Math.min(holeSpan, Math.max(0.08, h * 0.2))
  return {
    holes: [
      { x: edgeX, y: y - span / 2 },
      { x: edgeX, y: y + span / 2 },
    ],
  }
}

function makeSpec(config: Config, parts: Part[]): SpecRow[] {
  const rows: SpecRow[] = []
  const carcass = findById(boards, config.carcassBoard)
  const facade = findById(boards, config.facadeBoard)
  const carcassColor = findById(colors, config.carcassColor)
  const facadeColor = findById(colors, config.facadeColor)
  const handle = findById(handles, config.handle)
  const finish = findById(finishes, config.finish)
  const base = findById(bases, config.base)
  const posName = config.handlePos === 'top' ? 'верх' : config.handlePos === 'bottom' ? 'низ' : 'середина'
  const sideName = config.handleSide === 'hinge' ? 'у петли' : 'у открытия'

  const kindName = config.kind === 'pedestal' ? 'Тумба' : 'Шкаф'
  rows.push({ name: 'Изделие', value: kindName })
  rows.push({ name: 'Габарит', value: `${config.width} × ${config.height} × ${config.depth} мм` })
  rows.push({ name: 'Секции', value: `${config.sections}` })
  if (config.kind === 'pedestal') {
    rows.push({ name: 'Ящики', value: `${config.drawers} в колонке` })
    const runner = findRunner(config.runner)
    const lift = config.base === 'legs' ? 0.08 : 0.06
    const bodyH = Math.max(0.2, mm(config.height) - lift)
    const innerW = mm(config.width) - 2 * PANEL_T
    const openingW = (innerW - (config.sections - 1) * PANEL_T) / Math.max(1, config.sections)
    const slotH = (bodyH - 2 * PANEL_T) / Math.max(1, config.drawers)
    const openingD = Math.max(0.12, mm(config.depth) - 0.04)
    const sample = drawerBoxFromOpening(
      { openingW, openingH: slotH, openingD },
      config.runner,
    )
    rows.push({
      name: 'Направляющие',
      value: runnerSpecLine(config.runner, openingD * 1000),
    })
    rows.push({
      name: 'Короб ящика',
      value: `${Math.round(sample.boxW * 1000)} × ${Math.round(sample.boxH * 1000)} × ${Math.round(sample.boxD * 1000)} мм · зазор ${Math.round(runner.sideClear * 1000)} мм/сторона`,
    })
  } else {
    rows.push({ name: 'Полки', value: `${config.shelves} в секции` })
    rows.push({ name: 'Двери', value: findById(doorModes, config.doors).name })
  }
  rows.push({ name: 'Корпус', value: `${carcass.name} / ${carcassColor.name}` })
  rows.push({ name: 'Фасад', value: `${facade.name} / ${facadeColor.name} / ${findById(frameModes, config.frame).name}` })
  if (config.kind !== 'pedestal') {
    rows.push({ name: 'Зеркало', value: findById(mirrorModes, config.mirror).name })
  }
  rows.push({ name: 'Опора', value: base.name })
  const handleHw = findHandleHardware(config.handle)
  const spanNote = handleHw.holeSpanMm ? ` · межцентр ${handleHw.holeSpanMm} мм` : ''
  rows.push({
    name: 'Ручка',
    value: handle.id === 'none'
      ? 'Без ручки'
      : handle.id === 'cut'
        ? `Вырез в фасаде / ${posName}`
      : config.kind === 'pedestal'
        ? `${handle.name} / ${finish.name} / ${posName}${spanNote}`
        : `${handle.name} / ${finish.name} / ${posName} / ${sideName}${spanNote}`,
  })
  rows.push({ name: 'Задняя стенка', value: `ХДФ ${BOARD_T.hdf8 * 1000} мм накладная` })

  const fronts = parts.filter((part) => part.move)
  const swings = fronts.filter((part) => part.move === 'swing-left' || part.move === 'swing-right')
  const drawers = fronts.filter((part) => part.move === 'drawer')
  rows.push({ name: 'Фасады', value: `${fronts.length} шт` })
  const hingeCount = swings.reduce((sum, part) => sum + hingeHeights(part.size[1]).length, 0)
  if (hingeCount) {
    const hinge = findHinge('clip')
    rows.push({
      name: 'Петли',
      value: `${hingeCount} шт · ${hinge.name} · чашка ${hinge.cupMm}`,
    })
  }
  if (drawers.length && config.kind !== 'pedestal') {
    rows.push({ name: 'Направляющие', value: `${drawers.length} пар` })
  }
  if (drawers.length && config.kind === 'pedestal') {
    rows.push({ name: 'Пар направляющих', value: `${drawers.length} шт` })
  }

  const sheetRow = (name: string, roles: Role[]) => {
    const area = parts.filter((part) => roles.includes(part.role)).reduce((sum, part) => sum + panelArea(part.size), 0)
    if (area < 0.05) return
    const sheets = Math.max(1, Math.ceil(area / (2.8 * 2.07 * 0.82)))
    rows.push({ name, value: `${sheets} шт 2800×2070 / ${area.toFixed(2)} м²` })
  }
  sheetRow('Листы корпуса', ['carcass', 'plinth'])
  sheetRow('Листы фасада', ['facade'])
  sheetRow('Листы ХДФ', ['back'])
  for (const tape of buildTapes(config, parts)) {
    rows.push({ name: tape.name, value: `нужно ${tape.need} м / заказать ${tape.order} м` })
  }
  return rows
}

export function withNest(compiled: Omit<Compiled, 'nest'>): Compiled {
  const nest = nestCuts(compiled.cuts)
  return {
    ...compiled,
    nest,
    spec: [...compiled.spec, ...nestSpecRows(nest)],
  }
}

export function partLabel(part: Part) {
  if (part.role === 'facade' && part.mirror && part.mirror !== 'none') return 'Фасад с зеркалом'
  if (part.role === 'facade' && part.move === 'tilt') return 'Откидной фасад'
  if (part.role === 'facade' && part.move === 'drawer') return 'Фасад ящика'
  if (part.role === 'facade') return 'Фасад'
  if (part.role === 'back') return 'Задняя стенка'
  if (part.role === 'plinth') return 'Цоколь'
  if (part.key.includes('stop')) return 'Стоп ящика'
  if (part.key.includes('mech') || part.key.includes('rail')) return 'Механизм ящика'
  if (part.key.includes('hinge')) return 'Петля'
  if (part.key.includes('floor')) return 'Дно ящика'
  if (part.key.includes('box-back')) return 'Зад ящика'
  if (part.key.includes('lip')) return 'Упор пятки'
  if (part.key.includes('tray')) return 'Полка яруса'
  if (part.key.includes('shelf')) return 'Дно ящика'
  if (part.key.includes('div')) return 'Перегородка'
  if (part.key.includes('side')) return 'Боковина ящика'
  if (part.key.endsWith('-t')) return 'Крышка'
  if (part.key.endsWith('-b')) return 'Дно'
  if (part.key.endsWith('-l') || part.key.endsWith('-r')) return 'Боковина'
  if (part.key.includes('leg')) return 'Ножка'
  return 'Деталь'
}

function edgeOf(part: Part) {
  if (part.role === 'facade') return { label: '2 мм периметр', band: 2, mode: 'all' as const }
  if (part.role === 'back') return { label: 'без кромки', band: 0, mode: 'none' as const }
  if (part.role === 'plinth') return { label: '0.4 мм лицо', band: 0.4, mode: 'front' as const }
  if (part.role === 'carcass') return { label: '2 мм перед', band: 2, mode: 'front' as const }
  return { label: 'без кромки', band: 0, mode: 'none' as const }
}

function cutSize(part: Part) {
  const raw: [number, number, number] = [
    Math.round(part.size[0] * 1000),
    Math.round(part.size[1] * 1000),
    Math.round(part.size[2] * 1000),
  ]
  const edge = edgeOf(part)
  const thickAt = raw[0] <= raw[1] && raw[0] <= raw[2] ? 0 : raw[1] <= raw[2] ? 1 : 2
  const saw: [number, number, number] = [raw[0], raw[1], raw[2]]
  let tape = 0
  if (edge.mode === 'all') {
    for (let i = 0; i < 3; i++) {
      if (i !== thickAt) saw[i] -= edge.band * 2
    }
  } else if (edge.mode === 'front') {
    const reduce = thickAt === 2 ? 1 : 2
    saw[reduce] -= edge.band
    const front = [0, 1, 2].find((index) => index !== thickAt && index !== reduce) ?? 0
    tape = raw[front]
  }
  const face = [0, 1, 2].filter((i) => i !== thickAt)
  return {
    thick: raw[thickAt],
    length: Math.max(saw[face[0]], saw[face[1]]),
    width: Math.min(saw[face[0]], saw[face[1]]),
    sawL: Math.max(saw[face[0]], saw[face[1]]),
    sawW: Math.min(saw[face[0]], saw[face[1]]),
    edge: edge.label,
    tape,
  }
}

export function buildCuts(config: Config, parts: Part[]): CutRow[] {
  const map = new Map<string, CutRow>()
  for (const part of parts) {
    if (part.role === 'metal') continue
    const size = cutSize(part)
    const material =
      part.role === 'back'
        ? 'ХДФ 8'
        : part.role === 'facade'
          ? `${findById(boards, config.facadeBoard).name} / ${findById(colors, config.facadeColor).name}`
          : `${findById(boards, config.carcassBoard).name} / ${findById(colors, config.carcassColor).name}`
    const name = partLabel(part)
    const key = `${name}|${material}|${size.length}|${size.width}|${size.thick}|${size.edge}`
    const row = map.get(key)
    if (row) row.qty += 1
    else {
      map.set(key, {
        name,
        material,
        length: size.length,
        width: size.width,
        thick: size.thick,
        qty: 1,
        edge: size.edge,
        sawL: size.sawL,
        sawW: size.sawW,
      })
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

export function buildTapes(_config: Config, parts: Part[]): TapeRow[] {
  let need2 = 0
  let need04 = 0
  for (const part of parts) {
    if (part.role === 'metal' || part.role === 'back') continue
    const size = cutSize(part)
    if (size.edge.includes('2 мм')) {
      const peri = 2 * (size.length + size.width) / 1000
      need2 += peri
    } else if (size.edge.includes('0.4')) {
      need04 += size.tape / 1000
    }
  }
  const rows: TapeRow[] = []
  if (need2 > 0.05) rows.push({ name: 'Кромка 2 мм', need: Math.round(need2 * 10) / 10, order: Math.ceil(need2 + 1) })
  if (need04 > 0.05) rows.push({ name: 'Кромка 0.4 мм', need: Math.round(need04 * 10) / 10, order: Math.ceil(need04 + 1) })
  return rows
}

export function buildMarks(config: Config, parts: Part[]): MarkRow[] {
  const rows: MarkRow[] = []
  for (const part of parts) {
    if (!part.move) continue
    if (part.move === 'drawer') {
      const travelMm = Math.round((part.travel ?? 0.22) * 1000)
      const runner = findRunner(config.runner)
      rows.push({
        title: partLabel(part),
        text: `${runner.name} · ход ${travelMm} мм · посадка от низа проёма ${Math.round(runner.bottomClear * 1000)} мм · зазор ${Math.round(runner.sideClear * 1000)} мм/сторона`,
      })
    }
    if (part.move === 'tilt') {
      rows.push({
        title: partLabel(part),
        text: 'петля снизу / откидной механизм',
      })
    }
    if (part.move === 'swing-left' || part.move === 'swing-right') {
      const side = part.move === 'swing-left' ? 'слева' : 'справа'
      const hinge = findHinge('clip')
      rows.push({
        title: partLabel(part),
        text: `петли ${side} / ${hinge.name} · чашка ${hinge.cupMm} / от края ${hinge.edgeMm} мм / высоты ${hingeHeights(part.size[1]).map((y) => Math.round((part.size[1] / 2 + y) * 1000)).join(' · ')} мм`,
      })
    }
    if (config.handle !== 'none') {
      const plan = handlePlan(part, config.handle, config.handlePos, config.handleSide)
      if (plan.slot) {
        rows.push({
          title: `${partLabel(part)} · вырез`,
          text: `${Math.round(plan.slot.w * 1000)}×${Math.round(plan.slot.h * 1000)} мм · от левого ${Math.round((plan.slot.x - plan.slot.w / 2) * 1000)} · от низа ${Math.round((plan.slot.y - plan.slot.h / 2) * 1000)}`,
        })
      } else if (plan.holes.length) {
        rows.push({
          title: `${partLabel(part)} · ручка`,
          text: plan.holes.map((hole) => `${Math.round(hole.x * 1000)}×${Math.round(hole.y * 1000)}`).join(' / '),
        })
      }
    }
  }
  return rows
}

export function compile(input: Config, survey: Survey | null = null): Compiled {
  const opening = survey ? envelopeOf(survey) : null
  const config = sanitize(input, opening)
  const parts = buildParts(config)
  const placed = layout(parts)
  const mill = millJobs(
    placed.parts,
    config.patterns,
    config.frame,
    partLabel,
    millSlots(placed.parts, config.handle, config.handlePos, config.handleSide),
  )
  return withNest({
    parts: placed.parts,
    span: placed.span,
    dims: { w: mm(config.width), h: mm(config.height), d: mm(config.depth) },
    spec: [...surveyLines(survey, config), ...makeSpec(config, placed.parts)],
    cuts: buildCuts(config, placed.parts),
    tapes: buildTapes(config, placed.parts),
    marks: [...buildMarks(config, placed.parts), ...millMarks(mill)],
    mill,
  })
}
