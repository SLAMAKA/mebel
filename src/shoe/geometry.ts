import {
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
  layout,
  mm,
  partLabel,
  shell,
  withNest,
  type Compiled,
  type Part,
  type SpecRow,
} from '../geometry'
import { sanitizeShoe, shoeFaceHeightMm, shoeSections, type ShoeConfig } from './model'
import { BOARD_T } from '../hardware/catalog'
import { millJobs, millMarks, millSlots } from '../pattern/jobs'
import { envelopeOf, surveyLines, type Survey } from '../survey/model'

const LIFT = 0.05
/** Толщина деталей ящика — общая с корпусной фурнитурой. */
const BOARD = BOARD_T.ldsp16
/** Люфт между фасадами снаружи. */
const FACADE_GAP = 0.004
/** Фасад не прижат к торцу корпуса. */
const FRONT_GAP = 0.002
/**
 * Зазор между боковиной ящика и боковиной корпуса.
 * Сюда встаёт откидной механизм и упор.
 */
const SIDE_CLEAR = BOARD_T.ldsp16
/** Люфт ящика сверху и снизу в проёме. */
const SLOT_PLAY = 0.005
/** Ящик не доходит до задней стенки. */
const BACK_GAP = 0.022
/**
 * Глубина откидного ящика от фасада.
 * Не на весь корпус — иначе боковины не закроются в проём.
 */
const BOX_DEPTH_MAX = 0.155
/** Высота боковин от проёма — с запасом под дугу закрытия. */
const WALL_RATIO = 0.52
/** Карман между щитами под толщину обуви стоя. */
const POCKET = 0.08

function hiddenLegs(w: number, d: number, h: number): Part[] {
  const spots = [
    ['lb', -1, -1],
    ['rb', 1, -1],
    ['lf', -1, 1],
    ['rf', 1, 1],
  ] as const
  const side = 0.02
  return spots.map(([name, sx, sz]) => {
    const insetZ = sz > 0 ? 0.09 : 0.045
    return {
      key: `shoe-leg-${name}`,
      size: [side, h, side] as [number, number, number],
      pos: [sx * (w / 2 - 0.055), h / 2, sz * (d / 2 - insetZ)] as [number, number, number],
      role: 'metal' as const,
      shape: 'cyl' as const,
    }
  })
}

/**
 * Внутренний ящик под откидной фасад.
 * Щиты параллельно фасаду: обувь стоит носком вверх, подошва к щиту.
 */
function buildShoeParts(config: ShoeConfig): Part[] {
  const T = PANEL_T
  const w = mm(config.width)
  const h = mm(config.height)
  const d = mm(config.depth)
  const bodyH = Math.max(0.4, h - LIFT)
  const parts: Part[] = [
    ...shell('shoe', 0, LIFT, 0, w, bodyH, d),
    ...hiddenLegs(w, d, LIFT),
  ]

  const drawers = config.drawers
  const rows = Math.max(1, config.rows)
  const faceH = (bodyH - FACADE_GAP * (drawers + 1)) / drawers
  const faceW = w - FACADE_GAP * 2
  const doorZ = d / 2 + FRONT_GAP + T / 2

  const innerW = w - 2 * T
  const innerH = bodyH - 2 * T
  const innerFront = d / 2 - 0.001
  const innerBack = -d / 2 + 0.008 + 0.006
  const openingD = Math.max(0.1, innerFront - innerBack)

  const slot = (innerH - SLOT_PLAY * (drawers + 1)) / drawers
  const boxW = Math.max(0.12, innerW - SIDE_CLEAR * 2)
  const doorInnerZ = doorZ - T / 2
  // Перед у фасада, но не вылезает за плоскость проёма корпуса.
  const trayFront = Math.min(doorInnerZ - 0.0005, innerFront)
  const depthLimit = Math.min(BOX_DEPTH_MAX, Math.max(0.1, trayFront - (innerBack + BACK_GAP)))
  const needD = POCKET * (rows + 0.5) + BOARD * rows + 0.028
  const trayD = Math.min(depthLimit, Math.max(0.1, needD))
  const trayBack = trayFront - trayD
  const trayZ = (trayFront + trayBack) / 2

  // Ниже проёма — иначе при закрытии боковины упираются в корпус.
  const wallH = Math.max(
    0.1,
    Math.min(slot - BOARD - SLOT_PLAY * 2, slot * WALL_RATIO, faceH * 0.55),
  )
  const divH = wallH * 0.95
  const shelfH = wallH * 0.92
  const innerBox = boxW - 2 * BOARD
  const bayW = (innerBox - BOARD * (shoeSections - 1)) / shoeSections
  const pocket = Math.min(POCKET, Math.max(0.055, (trayD - BOARD * rows) / (rows + 0.35)))

  for (let k = 0; k < drawers; k++) {
    const faceKey = `shoe-face-${k}`
    const faceY = LIFT + FACADE_GAP + faceH / 2 + k * (faceH + FACADE_GAP)
    parts.push({
      key: faceKey,
      size: [faceW, faceH, T],
      pos: [0, faceY, doorZ],
      role: 'facade',
      move: 'tilt',
      face: 'pz',
      mirror: 'none',
    })

    const slotBottom = LIFT + T + SLOT_PLAY + k * (slot + SLOT_PLAY)
    const floorY = slotBottom + BOARD / 2
    const wallY = floorY + BOARD / 2 + wallH / 2
    const sideX = boxW / 2 - BOARD / 2

    // Дно под пятки, боковины и перегородка секций.
    parts.push(
      {
        key: `shoe-floor-${k}`,
        size: [boxW, BOARD, trayD],
        pos: [0, floorY, trayZ],
        role: 'carcass',
        host: faceKey,
      },
      {
        key: `shoe-side-l-${k}`,
        size: [BOARD, wallH, trayD],
        pos: [-sideX, wallY, trayZ],
        role: 'carcass',
        host: faceKey,
      },
      {
        key: `shoe-side-r-${k}`,
        size: [BOARD, wallH, trayD],
        pos: [sideX, wallY, trayZ],
        role: 'carcass',
        host: faceKey,
      },
      {
        key: `shoe-div-${k}`,
        size: [BOARD, divH, trayD - 0.01],
        pos: [0, floorY + BOARD / 2 + divH / 2, trayZ],
        role: 'carcass',
        host: faceKey,
      },
    )

    // Щиты // фасаду: подошва к щиту, носок вверх.
    const shelfY = floorY + BOARD / 2 + shelfH / 2
    for (let r = 0; r < rows; r++) {
      const z = trayFront - pocket * (r + 1) - BOARD * (r + 0.5)
      for (let s = 0; s < shoeSections; s++) {
        const left = -innerBox / 2 + s * (bayW + BOARD)
        const cx = left + bayW / 2
        const shelfW = Math.max(0.04, bayW - 0.002)
        parts.push({
          key: `shoe-tray-${k}-${r}-${s}`,
          size: [shelfW, shelfH, BOARD],
          pos: [cx, shelfY, z],
          role: 'carcass',
          host: faceKey,
        })
      }
    }

    const hingeY = faceY - faceH / 2 + 0.002
    const hingeZ = doorZ + T / 2
    for (const [name, sign] of [
      ['l', -1],
      ['r', 1],
    ] as const) {
      parts.push({
        key: `shoe-hinge-${name}-${k}`,
        size: [0.038, 0.01, 0.01],
        pos: [sign * (faceW / 2 - 0.055), hingeY, hingeZ],
        role: 'metal',
        shape: 'cyl',
        axis: 'x',
        host: faceKey,
      })
    }

    const carcassInner = w / 2 - T
    const damperY = floorY + BOARD / 2 + wallH * 0.62
    const damperZ = trayZ - trayD * 0.12
    for (const [name, sign] of [
      ['l', -1],
      ['r', 1],
    ] as const) {
      parts.push({
        key: `shoe-mech-base-${name}-${k}`,
        size: [0.012, 0.028, 0.028],
        pos: [sign * (carcassInner - 0.008), damperY, damperZ - 0.02],
        role: 'metal',
      })
      parts.push({
        key: `shoe-mech-rod-${name}-${k}`,
        size: [SIDE_CLEAR - 0.004, 0.012, 0.012],
        pos: [sign * (sideX + BOARD / 2 + (SIDE_CLEAR - 0.004) / 2), damperY, damperZ],
        role: 'metal',
        shape: 'cyl',
        axis: 'x',
        host: faceKey,
      })
      parts.push({
        key: `shoe-mech-clip-${name}-${k}`,
        size: [0.01, 0.022, 0.022],
        pos: [sign * (sideX + BOARD / 2 + 0.004), damperY, damperZ],
        role: 'metal',
        host: faceKey,
      })
    }

    const stopCloseY = slotBottom + slot - 0.012
    for (const [name, sign] of [
      ['l', -1],
      ['r', 1],
    ] as const) {
      parts.push({
        key: `shoe-stop-close-${name}-${k}`,
        size: [0.014, 0.014, 0.01],
        pos: [sign * (boxW / 2 + SIDE_CLEAR * 0.35), stopCloseY, innerFront - 0.008],
        role: 'metal',
        shape: 'cyl',
        axis: 'x',
      })
    }

    const stopOpenY = floorY + BOARD / 2 + 0.02
    const stopOpenZ = trayBack + 0.03
    for (const [name, sign] of [
      ['l', -1],
      ['r', 1],
    ] as const) {
      parts.push({
        key: `shoe-stop-open-${name}-${k}`,
        size: [0.01, 0.018, 0.028],
        pos: [sign * (carcassInner - 0.01), stopOpenY, stopOpenZ],
        role: 'metal',
      })
      parts.push({
        key: `shoe-stop-catch-${name}-${k}`,
        size: [0.006, 0.016, 0.02],
        pos: [sign * (sideX - BOARD / 2 - 0.002), floorY + BOARD / 2 + 0.018, trayBack + 0.012],
        role: 'metal',
        host: faceKey,
      })
    }

    const railH = Math.max(0.05, wallH + BOARD)
    const railD = Math.min(openingD * 0.7, trayD + 0.02)
    const railY = slotBottom + railH / 2
    for (const [name, sign] of [
      ['l', -1],
      ['r', 1],
    ] as const) {
      parts.push({
        key: `shoe-rail-${name}-${k}`,
        size: [0.004, railH, railD],
        pos: [sign * (carcassInner - 0.003), railY, trayZ],
        role: 'metal',
      })
    }
  }

  return parts
}

function makeShoeSpec(config: ShoeConfig, parts: Part[]): SpecRow[] {
  const carcass = findById(boards, config.carcassBoard)
  const facade = findById(boards, config.facadeBoard)
  const carcassColor = findById(colors, config.carcassColor)
  const facadeColor = findById(colors, config.facadeColor)
  const handle = findById(handles, config.handle)
  const finish = findById(finishes, config.finish)
  const faces = parts.filter((part) => part.move === 'tilt')
  const trays = parts.filter((part) => part.key.includes('shoe-tray-')).length
  const dampers = parts.filter((part) => part.key.includes('mech-rod')).length
  const stops = parts.filter((part) => part.key.includes('stop-')).length

  const Tmm = Math.round(PANEL_T * 1000)
  const clearMm = Math.round(SIDE_CLEAR * 1000)
  const pairs = config.drawers * shoeSections * config.rows

  return [
    { name: 'Изделие', value: 'Обувница ОБ-5' },
    { name: 'Габарит', value: `${config.width} × ${config.height} × ${config.depth} мм` },
    { name: 'Ящики', value: `${config.drawers} откидных · фасад ${shoeFaceHeightMm(config)} мм` },
    { name: 'Секции', value: `${shoeSections} в каждом ящике` },
    { name: 'Ярусы', value: `${config.rows} щита // фасаду · обувь стоя · до ${pairs} пар` },
    { name: 'Щиты ярусов', value: `${trays} шт` },
    { name: 'Вставка обуви', value: 'При откинутом фасаде · носок вверх · подошва к щиту' },
    { name: 'Механизм', value: 'Откидной + демпфер удержания' },
    { name: 'Высота от ящиков', value: `${config.drawers} × модуль → ${config.height} мм` },
    { name: 'Петли', value: `${faces.length * 2} шт по нижней кромке` },
    { name: 'Демпферы', value: `${dampers} шт` },
    { name: 'Стопы', value: `${stops} шт закрытие и открытие` },
    { name: 'Боковины ящика', value: `под обувь стоя · ${config.rows} щита · зазор ${clearMm} мм` },
    { name: 'Люфт фасада', value: '4 мм по контуру' },
    { name: 'Толщина корпуса', value: `${Tmm} мм` },
    { name: 'Опора', value: `Скрытые опоры / ${finish.name}` },
    { name: 'Корпус', value: `${carcass.name} / ${carcassColor.name}` },
    {
      name: 'Фасад материал',
      value: `${facade.name} / ${facadeColor.name} / ${findById(frameModes, config.frame).name}`,
    },
    {
      name: 'Ручка',
      value: handle.id === 'none' ? 'Без ручки' : handle.id === 'cut' ? 'Вырез в фасаде' : `${handle.name} / ${finish.name}`,
    },
    { name: 'Фасады', value: `${faces.length} шт` },
  ]
}

function asShopConfig(config: ShoeConfig): Config {
  return {
    kind: 'wardrobe',
    drawers: config.drawers,
    doors: 'swing',
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
    base: 'legs',
    width: config.width,
    height: config.height,
    depth: config.depth,
    sections: 1,
    shelves: 0,
    runner: 'ball',
    patterns: config.patterns,
  }
}

export function compileShoe(input: ShoeConfig, survey: Survey | null = null): Compiled {
  const opening = survey ? envelopeOf(survey) : null
  const config = sanitizeShoe(input, opening)
  const placed = layout(buildShoeParts(config))
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
    spec: [...surveyLines(survey, config), ...makeShoeSpec(config, placed.parts)],
    cuts: buildCuts(shop, placed.parts),
    tapes: buildTapes(shop, placed.parts),
    marks: [...buildMarks(shop, placed.parts), ...millMarks(mill)],
    mill,
  })
}
