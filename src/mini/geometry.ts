import {
  bases,
  boards,
  colors,
  finishes,
  findById,
  frameModes,
  handles,
  type Config,
} from '../model'
import {
  PANEL_T,
  buildCuts,
  buildMarks,
  buildTapes,
  hingeHeights,
  layout,
  mm,
  partLabel,
  shell,
  support,
  withNest,
  type Compiled,
  type Part,
  type SpecRow,
} from '../geometry'
import { millJobs, millMarks, millSlots } from '../pattern/jobs'
import { envelopeOf, surveyLines, type Survey } from '../survey/model'
import {
  miniFronts,
  miniLegs,
  miniMounts,
  miniVariants,
  sanitizeMini,
  type MiniConfig,
  type MiniLegId,
} from './model'

function miniLegParts(
  style: MiniLegId,
  prefix: string,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
): Part[] {
  const spots = [
    ['lb', -1, -1],
    ['rb', 1, -1],
    ['lf', -1, 1],
    ['rf', 1, 1],
  ] as const

  let side = 0.04
  let shape: Part['shape'] = 'box'
  let role: Part['role'] = 'metal'
  let inset = 0.055

  if (style === 'round') {
    side = 0.036
    shape = 'cyl'
  } else if (style === 'pin') {
    side = 0.02
    shape = 'cyl'
    inset = 0.045
  } else if (style === 'hairpin') {
    side = 0.012
    shape = 'cyl'
    inset = 0.04
  } else if (style === 'block') {
    side = 0.05
    shape = 'box'
    role = 'carcass'
    inset = 0.06
  }

  return spots.map(([name, sx, sz]) => ({
    key: `${prefix}-leg-${name}`,
    size: [side, h, side] as [number, number, number],
    pos: [x + sx * (w / 2 - inset), h / 2, z + sz * (d / 2 - inset)] as [number, number, number],
    role,
    shape,
  }))
}

function buildMiniParts(config: MiniConfig): Part[] {
  const T = PANEL_T
  const w = mm(config.width)
  const h = mm(config.height)
  const d = mm(config.depth)
  const wall = config.mount === 'wall'
  const lift = wall ? 0 : config.base === 'legs' ? 0.1 : 0.05
  const bodyH = Math.max(0.2, h - lift)
  const sections = Math.max(1, config.sections)
  const parts: Part[] = [...shell('mini', 0, lift, 0, w, bodyH, d)]

  if (!wall) {
    if (config.base === 'legs') {
      parts.push(...miniLegParts(config.leg, 'mini', 0, 0, w, d, lift))
    } else {
      parts.push(...support('mini', 'plinth', 0, 0, w, d, lift))
    }
  } else {
    // Кронштейны навесной: две металлические пластины сзади.
    const bracketH = Math.min(0.12, bodyH * 0.25)
    const bracketY = lift + bodyH * 0.72
    for (const [name, sx] of [
      ['l', -1],
      ['r', 1],
    ] as const) {
      parts.push({
        key: `mini-bracket-${name}`,
        size: [0.03, bracketH, 0.012],
        pos: [sx * (w / 2 - 0.05), bracketY, -d / 2 - 0.004],
        role: 'metal',
      })
    }
  }

  const innerW = w - 2 * T
  const bay = (innerW - (sections - 1) * T) / sections
  const origin = -innerW / 2
  const innerH = bodyH - 2 * T
  const y0 = lift + T

  for (let i = 1; i < sections; i++) {
    const x = origin + i * bay + (i - 0.5) * T
    parts.push({
      key: `mini-div-${i}`,
      size: [T, innerH, d - 0.03],
      pos: [x, y0 + innerH / 2, -0.006],
      role: 'carcass',
    })
  }

  // Полки.
  for (let s = 0; s < sections; s++) {
    const left = origin + s * (bay + T)
    if (bay < 0.03) continue
    for (let k = 0; k < config.shelves; k++) {
      parts.push({
        key: `mini-shelf-${s}-${k}`,
        size: [bay - 0.002, T, d - 0.07],
        pos: [left + bay / 2, y0 + ((k + 1) * innerH) / (config.shelves + 1), -0.015],
        role: 'carcass',
      })
    }
  }

  if (config.front === 'open') return parts

  const gap = 0.003
  const doorZ = d / 2 + T / 2 + 0.001

  if (config.front === 'flip') {
    // Одна откидная дверь на всю ширину.
    const doorW = w - gap * 2
    const doorH = bodyH - gap * 2
    parts.push({
      key: 'mini-flip',
      size: [doorW, doorH, T],
      pos: [0, lift + bodyH / 2, doorZ],
      role: 'facade',
      move: 'swing-left',
      face: 'pz',
      mirror: 'none',
    })
    return parts
  }

  const doorH = bodyH - gap * 2
  const doorY = lift + bodyH / 2
  const doorW = (w - gap * (sections + 1)) / sections
  for (let s = 0; s < sections; s++) {
    parts.push({
      key: `mini-door-${s}`,
      size: [doorW, doorH, T],
      pos: [-w / 2 + gap + doorW / 2 + s * (doorW + gap), doorY, doorZ],
      role: 'facade',
      move: s % 2 === 0 ? 'swing-left' : 'swing-right',
      face: 'pz',
      mirror: 'none',
    })
  }

  return parts
}

function makeMiniSpec(config: MiniConfig, parts: Part[]): SpecRow[] {
  const rows: SpecRow[] = []
  const variant = findById(miniVariants, config.variant)
  const carcass = findById(boards, config.carcassBoard)
  const facade = findById(boards, config.facadeBoard)
  const carcassColor = findById(colors, config.carcassColor)
  const facadeColor = findById(colors, config.facadeColor)
  const handle = findById(handles, config.handle)
  const finish = findById(finishes, config.finish)

  rows.push({ name: 'Изделие', value: 'Мини-шкафчик' })
  rows.push({ name: 'Вариант', value: variant.name })
  rows.push({ name: 'Крепление', value: findById(miniMounts, config.mount).name })
  rows.push({ name: 'Фасад', value: findById(miniFronts, config.front).name })
  rows.push({ name: 'Габарит', value: `${config.width} × ${config.height} × ${config.depth} мм` })
  rows.push({ name: 'Секции', value: `${config.sections}` })
  rows.push({ name: 'Полки', value: `${config.shelves} в секции` })
  rows.push({ name: 'Корпус', value: `${carcass.name} / ${carcassColor.name}` })
  rows.push({
    name: 'Фасад материал',
    value: `${facade.name} / ${facadeColor.name} / ${findById(frameModes, config.frame).name}`,
  })
  if (config.mount === 'floor') {
    rows.push({
      name: 'Опора',
      value: config.base === 'legs'
        ? `Ножки · ${findById(miniLegs, config.leg).name}`
        : findById(bases, config.base).name,
    })
  } else {
    rows.push({ name: 'Крепёж', value: 'Настенные кронштейны' })
  }
  rows.push({
    name: 'Ручка',
    value: handle.id === 'none' ? 'Без ручки' : handle.id === 'cut' ? 'Вырез в фасаде' : `${handle.name} / ${finish.name}`,
  })

  const fronts = parts.filter((part) => part.move)
  rows.push({ name: 'Фасады', value: `${fronts.length} шт` })
  const swings = fronts.filter((part) => part.move === 'swing-left' || part.move === 'swing-right')
  const drawers = fronts.filter((part) => part.move === 'drawer')
  const hingeCount = swings.reduce((sum, part) => sum + hingeHeights(part.size[1]).length, 0)
  if (hingeCount) rows.push({ name: 'Петли', value: `${hingeCount} шт` })
  if (drawers.length) rows.push({ name: 'Направляющие', value: `${drawers.length} пар` })

  return rows
}

function asShopConfig(config: MiniConfig): Config {
  return {
    kind: 'wardrobe',
    drawers: 0,
    doors: config.front === 'open' ? 'open' : 'swing',
    mirror: 'none',
    carcassBoard: config.carcassBoard,
    carcassColor: config.carcassColor,
    facadeBoard: config.facadeBoard,
    facadeColor: config.facadeColor,
    handle: config.handle,
    handlePos: config.handlePos,
    handleSide: config.handleSide,
    finish: config.finish,
    frame: config.frame,
    base: config.base,
    width: config.width,
    height: config.height,
    depth: config.depth,
    sections: config.sections,
    shelves: config.shelves,
    runner: 'ball',
    patterns: config.patterns,
  }
}

export function compileMini(input: MiniConfig, survey: Survey | null = null): Compiled {
  const opening = survey ? envelopeOf(survey) : null
  const config = sanitizeMini(input, opening)
  const parts = buildMiniParts(config)
  const placed = layout(parts)
  const shop = asShopConfig(config)
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
    spec: [...surveyLines(survey, config), ...makeMiniSpec(config, placed.parts)],
    cuts: buildCuts(shop, placed.parts),
    tapes: buildTapes(shop, placed.parts),
    marks: [...buildMarks(shop, placed.parts), ...millMarks(mill)],
    mill,
  })
}
