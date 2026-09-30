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
  shell,
  type Compiled,
  type Part,
  type SpecRow,
} from '../geometry'
import { sanitizeShoe, shoeSections, type ShoeConfig } from './model'

const LIFT = 0.05
const BOARD = 0.016
/** Люфт между фасадами и по наружному контуру. */
const FACADE_GAP = 0.004
/** Фасад не прижат к торцу корпуса. */
const FRONT_GAP = 0.002
/** Место под откидной механизм с каждой стороны. */
const MECH_GAP = 0.013
/** Люфт ящика внутри проёма. */
const BOX_PLAY = 0.004
/** Ящик не доходит до задней стенки. */
const BACK_GAP = 0.012
const BACK_FACE = 0.014

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
  const faceH = (bodyH - FACADE_GAP * (drawers + 1)) / drawers
  const faceW = w - FACADE_GAP * 2
  const doorZ = d / 2 + FRONT_GAP + T / 2
  const innerW = w - 2 * T
  const innerH = bodyH - 2 * T
  const boxW = innerW - MECH_GAP * 2
  const slot = (innerH - BOX_PLAY * (drawers + 1)) / drawers
  const trayFront = d / 2 + FRONT_GAP - 0.001
  const trayBack = -d / 2 + BACK_FACE + BACK_GAP
  const trayD = Math.max(0.08, trayFront - trayBack)
  const trayZ = (trayFront + trayBack) / 2
  const wallH = Math.max(0.04, slot - BOARD - BOX_PLAY)

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

    const y0 = LIFT + T + BOX_PLAY + k * (slot + BOX_PLAY)
    const floorY = y0 + BOARD / 2
    const wallY = y0 + BOARD + wallH / 2
    parts.push(
      {
        key: `shoe-shelf-${k}`,
        size: [boxW, BOARD, trayD],
        pos: [0, floorY, trayZ],
        role: 'carcass',
        host: faceKey,
      },
      {
        key: `shoe-side-l-${k}`,
        size: [BOARD, wallH, trayD],
        pos: [-(boxW / 2 - BOARD / 2), wallY, trayZ],
        role: 'carcass',
        host: faceKey,
      },
      {
        key: `shoe-side-r-${k}`,
        size: [BOARD, wallH, trayD],
        pos: [boxW / 2 - BOARD / 2, wallY, trayZ],
        role: 'carcass',
        host: faceKey,
      },
      {
        key: `shoe-div-${k}`,
        size: [BOARD, wallH * 0.86, trayD - 0.008],
        pos: [0, y0 + BOARD + (wallH * 0.86) / 2, trayZ],
        role: 'carcass',
        host: faceKey,
      },
    )

    const railT = 0.004
    const railH = Math.max(0.04, slot - BOX_PLAY * 2)
    const railD = Math.min(trayD * 0.72, trayD - 0.02)
    const railY = y0 + BOX_PLAY + railH / 2
    for (const [name, sign] of [
      ['l', -1],
      ['r', 1],
    ] as const) {
      const innerFace = sign * (w / 2 - T)
      parts.push({
        key: `shoe-mech-${name}-${k}`,
        size: [railT, railH, railD],
        pos: [innerFace - sign * (0.001 + railT / 2), railY, trayZ],
        role: 'metal',
      })
    }

    const hingeY = faceY - faceH / 2 + 0.001
    const hingeZ = doorZ + T / 2
    for (const [name, sign] of [
      ['l', -1],
      ['r', 1],
    ] as const) {
      parts.push({
        key: `shoe-hinge-${name}-${k}`,
        size: [0.036, 0.008, 0.008],
        pos: [sign * (faceW / 2 - 0.06), hingeY, hingeZ],
        role: 'metal',
        shape: 'cyl',
        axis: 'x',
        host: faceKey,
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

  return [
    { name: 'Изделие', value: 'Обувница ОБ-5' },
    { name: 'Габарит', value: `${config.width} × ${config.height} × ${config.depth} мм` },
    { name: 'Ящики', value: `${config.drawers} откидных` },
    { name: 'Секции', value: `${shoeSections} в каждом ящике` },
    { name: 'Механизм', value: 'Откидной ящик на нижней петле' },
    { name: 'Петли', value: `${faces.length * 2} шт по нижней кромке` },
    { name: 'Люфт фасада', value: '4 мм по контуру' },
    { name: 'Зазор механизма', value: '13 мм с каждой стороны' },
    { name: 'Опора', value: `Скрытые опоры / ${finish.name}` },
    { name: 'Корпус', value: `${carcass.name} / ${carcassColor.name}` },
    {
      name: 'Фасад материал',
      value: `${facade.name} / ${facadeColor.name} / ${findById(frameModes, config.frame).name}`,
    },
    {
      name: 'Ручка',
      value: handle.id === 'none' ? 'Без ручки' : `${handle.name} / ${finish.name}`,
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
  }
}

export function compileShoe(input: ShoeConfig): Compiled {
  const config = sanitizeShoe(input)
  const placed = layout(buildShoeParts(config))
  const shop = asShopConfig(config)
  return {
    parts: placed.parts,
    span: placed.span,
    dims: { w: mm(config.width), h: mm(config.height), d: mm(config.depth) },
    spec: makeShoeSpec(config, placed.parts),
    cuts: buildCuts(shop, placed.parts),
    tapes: buildTapes(shop, placed.parts),
    marks: buildMarks(shop, placed.parts),
  }
}
