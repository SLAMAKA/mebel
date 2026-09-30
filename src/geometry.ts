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
}

export const PANEL_T = 0.018

export function mm(value: number) {
  return value / 1000
}

export function shell(prefix: string, x: number, yBottom: number, z: number, w: number, h: number, d: number): Part[] {
  const T = PANEL_T
  const y = yBottom + h / 2
  const innerW = Math.max(0.02, w - 2 * T)
  const innerH = Math.max(0.02, h - 2 * T)
  const backT = 0.008
  return [
    { key: `${prefix}-l`, size: [T, h, d], pos: [x - w / 2 + T / 2, y, z], role: 'carcass' },
    { key: `${prefix}-r`, size: [T, h, d], pos: [x + w / 2 - T / 2, y, z], role: 'carcass' },
    { key: `${prefix}-t`, size: [innerW, T, d], pos: [x, yBottom + h - T / 2, z], role: 'carcass' },
    { key: `${prefix}-b`, size: [innerW, T, d], pos: [x, yBottom + T / 2, z], role: 'carcass' },
    { key: `${prefix}-back`, size: [innerW, innerH, backT], pos: [x, y, z - d / 2 + backT / 2 + 0.006], role: 'back' },
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
  const w = mm(config.width)
  const h = mm(config.height)
  const d = mm(config.depth)
  const lift = config.base === 'legs' ? 0.08 : 0.06
  const bodyH = Math.max(0.2, h - lift)
  const sections = Math.max(1, config.sections)
  const drawers = Math.max(1, config.drawers)
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
    for (let k = 1; k < drawers; k++) {
      parts.push({
        key: `cab-tray-${s}-${k}`,
        size: [clear - 0.002, T, d - 0.1],
        pos: [left + clear / 2, y0 + (k * innerH) / drawers, -0.02],
        role: 'carcass',
      })
    }
  }

  const gap = 0.003
  const faceH = (bodyH - gap * (drawers + 1)) / drawers
  const doorZ = d / 2 + T / 2 + 0.001
  for (let s = 0; s < sections; s++) {
    const faceW = (w - gap * (sections + 1)) / sections
    const x = -w / 2 + gap + faceW / 2 + s * (faceW + gap)
    for (let k = 0; k < drawers; k++) {
      const y = lift + gap + faceH / 2 + k * (faceH + gap)
      parts.push({
        key: `cab-drawer-${s}-${k}`,
        size: [faceW, faceH, T],
        pos: [x, y, doorZ],
        role: 'facade',
        move: 'drawer',
        face: 'pz',
        mirror: 'none',
      })
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

export function handlePlan(
  part: Part,
  handle: HandleId,
  pos: HandlePosId = 'middle',
  side: HandleSideId = 'open',
) {
  const w = part.size[0]
  const h = part.size[1]
  if (handle === 'none') return { holes: [] as { x: number; y: number }[] }

  const y = alongHeight(h, pos)

  // Ящик и откидной фасад: ручка по центру.
  if (part.move === 'drawer' || part.move === 'tilt') {
    if (handle === 'knob') return { holes: [{ x: w * 0.5, y }] }
    if (handle === 'edge') return { holes: [{ x: w * 0.5, y: h * 0.92 }] }
    const span = Math.min(0.28, Math.max(0.12, w * 0.35))
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
    const span = Math.min(0.18, Math.max(0.1, h * 0.1))
    return {
      holes: [
        { x: edgeX, y: y - span / 2 },
        { x: edgeX, y: y + span / 2 },
      ],
    }
  }

  if (handle === 'rail') {
    const span = Math.min(0.64, Math.max(0.28, w * 0.55))
    const cx = onLeft ? w * 0.38 : w * 0.62
    return {
      holes: [
        { x: cx - span / 2, y },
        { x: cx + span / 2, y },
      ],
    }
  }

  const span = Math.min(0.22, Math.max(0.1, h * 0.12))
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
  rows.push({
    name: 'Ручка',
    value: handle.id === 'none'
      ? 'Без ручки'
      : config.kind === 'pedestal'
        ? `${handle.name} / ${finish.name} / ${posName}`
        : `${handle.name} / ${finish.name} / ${posName} / ${sideName}`,
  })
  rows.push({ name: 'Задняя стенка', value: 'ХДФ 8 мм накладная' })

  const fronts = parts.filter((part) => part.move)
  const swings = fronts.filter((part) => part.move === 'swing-left' || part.move === 'swing-right')
  const drawers = fronts.filter((part) => part.move === 'drawer')
  rows.push({ name: 'Фасады', value: `${fronts.length} шт` })
  const hingeCount = swings.reduce((sum, part) => sum + hingeHeights(part.size[1]).length, 0)
  if (hingeCount) rows.push({ name: 'Петли', value: `${hingeCount} шт скрытые` })
  if (drawers.length) rows.push({ name: 'Направляющие', value: `${drawers.length} пар` })

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

export function partLabel(part: Part) {
  if (part.role === 'facade' && part.mirror && part.mirror !== 'none') return 'Фасад с зеркалом'
  if (part.role === 'facade' && part.move === 'tilt') return 'Откидной фасад'
  if (part.role === 'facade' && part.move === 'drawer') return 'Фасад ящика'
  if (part.role === 'facade') return 'Фасад'
  if (part.role === 'back') return 'Задняя стенка'
  if (part.role === 'plinth') return 'Цоколь'
  if (part.key.includes('shelf')) return 'Полка'
  if (part.key.includes('div')) return 'Перегородка'
  if (part.key.endsWith('-t')) return 'Крышка'
  if (part.key.endsWith('-b')) return 'Дно'
  if (part.key.endsWith('-l') || part.key.endsWith('-r')) return 'Боковина'
  if (part.key.includes('side')) return 'Боковина лотка'
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
    if (part.move === 'tilt') {
      rows.push({
        title: partLabel(part),
        text: 'петля снизу / откидной механизм',
      })
    }
    if (part.move === 'swing-left' || part.move === 'swing-right') {
      const side = part.move === 'swing-left' ? 'слева' : 'справа'
      rows.push({
        title: partLabel(part),
        text: `петли ${side} / чашка 35 / от края 22 мм / высоты ${hingeHeights(part.size[1]).map((y) => Math.round((part.size[1] / 2 + y) * 1000)).join(' · ')} мм`,
      })
    }
    if (config.handle !== 'none') {
      const plan = handlePlan(part, config.handle, config.handlePos, config.handleSide)
      if (plan.holes.length) {
        rows.push({
          title: `${partLabel(part)} · ручка`,
          text: plan.holes.map((hole) => `${Math.round(hole.x * 1000)}×${Math.round(hole.y * 1000)}`).join(' / '),
        })
      }
    }
  }
  return rows
}

export function compile(input: Config): Compiled {
  const config = sanitize(input)
  const parts = buildParts(config)
  const placed = layout(parts)
  return {
    parts: placed.parts,
    span: placed.span,
    dims: { w: mm(config.width), h: mm(config.height), d: mm(config.depth) },
    spec: makeSpec(config, placed.parts),
    cuts: buildCuts(config, placed.parts),
    tapes: buildTapes(config, placed.parts),
    marks: buildMarks(config, placed.parts),
  }
}
